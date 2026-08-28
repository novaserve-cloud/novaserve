/**
 * Docker Compose File Generator — Production Multi-Service Orchestration
 *
 * Maps Nova IR resources to Docker Compose service definitions
 * with networking, volumes, security, health checks, and resource limits.
 */

import type { Resource } from "novaserve-core";
import type {
  DockerDeploymentContext,
  DockerProviderConfig,
  DockerServiceDefinition,
  DockerSecurityConfig,
  DockerHealthCheckConfig,
  DockerResourceLimits,
  DockerNetworkConfig,
  DockerRestartPolicy,
  ComposeFile,
} from "../types.js";

/** Database images for bundled dependency mode */
const DEPENDENCY_IMAGES: Record<string, { image: string; port: number; env: Record<string, string>; healthCmd: string[] }> = {
  postgres: {
    image: "postgres:16-alpine",
    port: 5432,
    env: {
      POSTGRES_DB: "${DB_NAME:-novaserve}",
      POSTGRES_USER: "${DB_USER:-novaserve}",
      POSTGRES_PASSWORD: "${DB_PASSWORD:-changeme}",
    },
    healthCmd: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-novaserve}"],
  },
  mysql: {
    image: "mysql:8.0",
    port: 3306,
    env: {
      MYSQL_DATABASE: "${DB_NAME:-novaserve}",
      MYSQL_USER: "${DB_USER:-novaserve}",
      MYSQL_PASSWORD: "${DB_PASSWORD:-changeme}",
      MYSQL_ROOT_PASSWORD: "${DB_ROOT_PASSWORD:-changeme}",
    },
    healthCmd: ["CMD", "mysqladmin", "ping", "-h", "localhost"],
  },
  mongodb: {
    image: "mongo:7",
    port: 27017,
    env: {
      MONGO_INITDB_ROOT_USERNAME: "${DB_USER:-novaserve}",
      MONGO_INITDB_ROOT_PASSWORD: "${DB_PASSWORD:-changeme}",
    },
    healthCmd: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"],
  },
  redis: {
    image: "redis:7-alpine",
    port: 6379,
    env: {},
    healthCmd: ["CMD", "redis-cli", "ping"],
  },
};

/** MinIO for S3-compatible storage */
const MINIO_CONFIG = {
  image: "minio/minio:latest",
  port: 9000,
  consolePort: 9001,
  env: {
    MINIO_ROOT_USER: "${STORAGE_ACCESS_KEY:-minioadmin}",
    MINIO_ROOT_PASSWORD: "${STORAGE_SECRET_KEY:-minioadmin}",
  },
};

/**
 * Generate a complete Docker Compose file from Nova IR resources.
 */
export function generateComposeFile(
  ctx: DockerDeploymentContext,
  resources: Resource[],
  runtime: string = "node20"
): ComposeFile {
  const config = ctx.dockerConfig;
  const services: Record<string, DockerServiceDefinition> = {};
  const networks: ComposeFile["networks"] = {};
  const volumes: ComposeFile["volumes"] = {};

  const security = resolveSecurityDefaults(config.security);
  const restartPolicy = config.restartPolicy || "unless-stopped";
  const bundleDeps = config.bundleDependencies ?? false;

  // ── Setup Networks ──────────────────────────────────────
  const networkConfig = config.network || {};
  const publicNetworkName = networkConfig.networkNames?.public || `${ctx.projectName}-public`;
  const internalNetworkName = networkConfig.networkNames?.internal || `${ctx.projectName}-internal`;

  if (networkConfig.public !== false) {
    networks[publicNetworkName] = {
      driver: "bridge",
      labels: buildNovaLabels(ctx),
      ...(networkConfig.ipv6 ? { enable_ipv6: true } : {}),
    };
  }

  if (networkConfig.internal !== false) {
    networks[internalNetworkName] = {
      driver: "bridge",
      internal: true,
      labels: buildNovaLabels(ctx),
    };
  }

  // Collect dependency services that will be bundled
  const bundledDependencies: string[] = [];

  // ── Map Resources to Services ──────────────────────────
  for (const resource of resources) {
    switch (resource.type) {
      case "api": {
        const port = (resource.config.port as number) || 3000;
        const svc = buildAppService(ctx, resource, port, security, restartPolicy, config, publicNetworkName, internalNetworkName);
        services[serviceName(ctx, resource.name)] = svc;
        break;
      }

      case "function": {
        const svc = buildFunctionService(ctx, resource, security, restartPolicy, config, internalNetworkName);
        services[serviceName(ctx, `fn-${resource.name}`)] = svc;
        break;
      }

      case "queue": {
        const svc = buildWorkerService(ctx, resource, "queue", security, restartPolicy, config, internalNetworkName);
        services[serviceName(ctx, `worker-${resource.name}`)] = svc;
        break;
      }

      case "cron": {
        const svc = buildWorkerService(ctx, resource, "cron", security, restartPolicy, config, internalNetworkName);
        services[serviceName(ctx, `cron-${resource.name}`)] = svc;
        break;
      }

      case "database": {
        if (bundleDeps) {
          const engine = (resource.config.engine as string) || (resource.config.version as string) ? "postgres" : "postgres";
          const dbConfig = DEPENDENCY_IMAGES[engine];
          if (dbConfig) {
            const dbName = serviceName(ctx, resource.name);
            services[dbName] = buildDatabaseService(ctx, resource, dbConfig, internalNetworkName, restartPolicy);
            volumes[`${dbName}-data`] = { labels: buildNovaLabels(ctx) };
            bundledDependencies.push(dbName);
          }
        }
        break;
      }

      case "cache": {
        if (bundleDeps) {
          const cacheName = serviceName(ctx, resource.name);
          services[cacheName] = buildCacheService(ctx, resource, internalNetworkName, restartPolicy);
          volumes[`${cacheName}-data`] = { labels: buildNovaLabels(ctx) };
          bundledDependencies.push(cacheName);
        }
        break;
      }

      case "storage": {
        if (bundleDeps) {
          const storageName = serviceName(ctx, resource.name);
          services[storageName] = buildStorageService(ctx, resource, internalNetworkName, restartPolicy);
          volumes[`${storageName}-data`] = { labels: buildNovaLabels(ctx) };
          bundledDependencies.push(storageName);
        }
        break;
      }

      // secret, cdn, websocket, email, search, auth — handled via environment variables, not as separate services
      default:
        break;
    }
  }

  // ── Add depends_on for bundled dependencies ────────────
  if (bundledDependencies.length > 0) {
    for (const [svcName, svc] of Object.entries(services)) {
      if (svc.build) {
        // This is an application service — add dependency on bundled services
        svc.dependsOn = {};
        for (const dep of bundledDependencies) {
          svc.dependsOn[dep] = { condition: "service_healthy" };
        }
      }
    }
  }

  return { services, networks, volumes };
}

/**
 * Serialize a ComposeFile to YAML string.
 */
export function serializeComposeFile(compose: ComposeFile): string {
  const lines: string[] = [];

  // Services
  lines.push("services:");
  for (const [name, svc] of Object.entries(compose.services)) {
    lines.push(`  ${name}:`);
    serializeService(lines, svc, 4);
  }

  // Networks
  if (compose.networks && Object.keys(compose.networks).length > 0) {
    lines.push("");
    lines.push("networks:");
    for (const [name, net] of Object.entries(compose.networks)) {
      lines.push(`  ${name}:`);
      if (net.driver) lines.push(`    driver: ${net.driver}`);
      if (net.internal) lines.push(`    internal: true`);
      if (net.enable_ipv6) lines.push(`    enable_ipv6: true`);
      if (net.labels) {
        lines.push(`    labels:`);
        for (const [k, v] of Object.entries(net.labels)) {
          lines.push(`      ${k}: "${v}"`);
        }
      }
    }
  }

  // Volumes
  if (compose.volumes && Object.keys(compose.volumes).length > 0) {
    lines.push("");
    lines.push("volumes:");
    for (const [name, vol] of Object.entries(compose.volumes)) {
      lines.push(`  ${name}:`);
      if (vol.driver) lines.push(`    driver: ${vol.driver}`);
      if (vol.external) lines.push(`    external: true`);
      if (vol.labels) {
        lines.push(`    labels:`);
        for (const [k, v] of Object.entries(vol.labels)) {
          lines.push(`      ${k}: "${v}"`);
        }
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

// ── Service Builders ──────────────────────────────────────────

function buildAppService(
  ctx: DockerDeploymentContext,
  resource: Resource,
  port: number,
  security: Required<DockerSecurityConfig>,
  restartPolicy: DockerRestartPolicy,
  config: DockerProviderConfig,
  publicNetwork: string,
  internalNetwork: string
): DockerServiceDefinition {
  const svc: DockerServiceDefinition = {
    name: resource.name,
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    ports: [{ host: port, container: port }],
    environment: {
      NODE_ENV: "production",
      PORT: String(port),
    },
    envFile: [".env"],
    networks: [publicNetwork, internalNetwork],
    restart: restartPolicy,
    labels: {
      ...buildNovaLabels(ctx),
      "dev.novaserve.resource": resource.name,
      "dev.novaserve.type": resource.type,
    },
    stop_signal: "SIGTERM",
    stop_grace_period: `${config.stopGracePeriod || 30}s`,
  };

  // Security hardening
  applySecurity(svc, security);

  // Resource limits
  if (config.resources) {
    svc.deploy = { resources: config.resources };
  }

  // Health check
  const hc = config.healthCheck;
  if (hc && hc.type !== "none") {
    svc.healthcheck = {
      test: buildHealthCheckTest(hc, port),
      interval: `${hc.interval || 15}s`,
      timeout: `${hc.timeout || 5}s`,
      retries: hc.retries || 3,
      start_period: `${hc.startPeriod || 30}s`,
    };
  }

  return svc;
}

function buildFunctionService(
  ctx: DockerDeploymentContext,
  resource: Resource,
  security: Required<DockerSecurityConfig>,
  restartPolicy: DockerRestartPolicy,
  config: DockerProviderConfig,
  internalNetwork: string
): DockerServiceDefinition {
  const svc: DockerServiceDefinition = {
    name: `fn-${resource.name}`,
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    environment: {
      NODE_ENV: "production",
      NOVA_FUNCTION: resource.name,
    },
    envFile: [".env"],
    networks: [internalNetwork],
    restart: restartPolicy,
    labels: {
      ...buildNovaLabels(ctx),
      "dev.novaserve.resource": resource.name,
      "dev.novaserve.type": "function",
    },
    stop_signal: "SIGTERM",
    stop_grace_period: `${config.stopGracePeriod || 30}s`,
  };

  applySecurity(svc, security);
  if (config.resources) {
    svc.deploy = { resources: config.resources };
  }

  return svc;
}

function buildWorkerService(
  ctx: DockerDeploymentContext,
  resource: Resource,
  type: "queue" | "cron",
  security: Required<DockerSecurityConfig>,
  restartPolicy: DockerRestartPolicy,
  config: DockerProviderConfig,
  internalNetwork: string
): DockerServiceDefinition {
  const svc: DockerServiceDefinition = {
    name: `${type}-${resource.name}`,
    build: {
      context: ".",
      dockerfile: "Dockerfile",
    },
    environment: {
      NODE_ENV: "production",
      [`NOVA_${type.toUpperCase()}`]: resource.name,
    },
    envFile: [".env"],
    networks: [internalNetwork],
    restart: restartPolicy,
    labels: {
      ...buildNovaLabels(ctx),
      "dev.novaserve.resource": resource.name,
      "dev.novaserve.type": type,
    },
    stop_signal: "SIGTERM",
    stop_grace_period: `${config.stopGracePeriod || 30}s`,
  };

  applySecurity(svc, security);
  if (config.resources) {
    svc.deploy = { resources: config.resources };
  }

  return svc;
}

function buildDatabaseService(
  ctx: DockerDeploymentContext,
  resource: Resource,
  dbConfig: typeof DEPENDENCY_IMAGES[string],
  internalNetwork: string,
  restartPolicy: DockerRestartPolicy
): DockerServiceDefinition {
  const name = resource.name;
  return {
    name,
    image: dbConfig.image,
    environment: { ...dbConfig.env },
    networks: [internalNetwork],
    restart: restartPolicy,
    volumes: [{ name: `${serviceName(ctx, name)}-data`, type: "named", target: getDataPath(dbConfig.image) }],
    healthcheck: {
      test: dbConfig.healthCmd,
      interval: "10s",
      timeout: "5s",
      retries: 5,
      start_period: "30s",
    },
    labels: {
      ...buildNovaLabels(ctx),
      "dev.novaserve.resource": name,
      "dev.novaserve.type": "database",
      "dev.novaserve.managed-dependency": "true",
    },
    ports: [{ host: dbConfig.port, container: dbConfig.port }],
  };
}

function buildCacheService(
  ctx: DockerDeploymentContext,
  resource: Resource,
  internalNetwork: string,
  restartPolicy: DockerRestartPolicy
): DockerServiceDefinition {
  const redis = DEPENDENCY_IMAGES["redis"]!;
  return {
    name: resource.name,
    image: redis.image,
    networks: [internalNetwork],
    restart: restartPolicy,
    volumes: [{ name: `${serviceName(ctx, resource.name)}-data`, type: "named", target: "/data" }],
    healthcheck: {
      test: redis.healthCmd,
      interval: "10s",
      timeout: "5s",
      retries: 3,
      start_period: "10s",
    },
    labels: {
      ...buildNovaLabels(ctx),
      "dev.novaserve.resource": resource.name,
      "dev.novaserve.type": "cache",
      "dev.novaserve.managed-dependency": "true",
    },
    command: ["redis-server", "--appendonly", "yes"],
  };
}

function buildStorageService(
  ctx: DockerDeploymentContext,
  resource: Resource,
  internalNetwork: string,
  restartPolicy: DockerRestartPolicy
): DockerServiceDefinition {
  return {
    name: resource.name,
    image: MINIO_CONFIG.image,
    environment: { ...MINIO_CONFIG.env },
    networks: [internalNetwork],
    restart: restartPolicy,
    volumes: [{ name: `${serviceName(ctx, resource.name)}-data`, type: "named", target: "/data" }],
    ports: [
      { host: MINIO_CONFIG.port, container: MINIO_CONFIG.port },
      { host: MINIO_CONFIG.consolePort, container: MINIO_CONFIG.consolePort },
    ],
    healthcheck: {
      test: ["CMD", "mc", "ready", "local"],
      interval: "10s",
      timeout: "5s",
      retries: 3,
      start_period: "15s",
    },
    labels: {
      ...buildNovaLabels(ctx),
      "dev.novaserve.resource": resource.name,
      "dev.novaserve.type": "storage",
      "dev.novaserve.managed-dependency": "true",
    },
    command: ["server", "/data", "--console-address", ":9001"],
  };
}

// ── Helpers ────────────────────────────────────────────────

function serviceName(ctx: DockerDeploymentContext, name: string): string {
  return sanitizeDockerName(`${ctx.projectName}-${name}`);
}

/**
 * Sanitize a name for Docker (lowercase, alphanumeric + hyphens, max 63 chars).
 */
export function sanitizeDockerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

function resolveSecurityDefaults(config?: DockerSecurityConfig): Required<DockerSecurityConfig> {
  return {
    nonRoot: config?.nonRoot ?? true,
    user: config?.user ?? "novaserve",
    readOnlyRootFilesystem: config?.readOnlyRootFilesystem ?? true,
    dropCapabilities: config?.dropCapabilities ?? true,
    noNewPrivileges: config?.noNewPrivileges ?? true,
    tmpfsMounts: config?.tmpfsMounts ?? ["/tmp"],
    writablePaths: config?.writablePaths ?? [],
  };
}

function applySecurity(svc: DockerServiceDefinition, security: Required<DockerSecurityConfig>): void {
  if (security.noNewPrivileges) {
    svc.security_opt = ["no-new-privileges:true"];
  }
  if (security.dropCapabilities) {
    svc.cap_drop = ["ALL"];
  }
  if (security.readOnlyRootFilesystem) {
    svc.read_only = true;
    svc.tmpfs = security.tmpfsMounts;
  }
}

function buildNovaLabels(ctx: DockerDeploymentContext): Record<string, string> {
  return {
    "dev.novaserve.managed": "true",
    "dev.novaserve.application": ctx.appName,
    "dev.novaserve.environment": ctx.environment,
    "dev.novaserve.project": ctx.projectName,
  };
}

function buildHealthCheckTest(hc: DockerHealthCheckConfig, port: number): string[] {
  if (hc.command) {
    return ["CMD-SHELL", hc.command];
  }
  const endpoint = hc.endpoint || "/health";
  const hcPort = hc.port || port;
  return ["CMD-SHELL", `wget --no-verbose --tries=1 --spider http://localhost:${hcPort}${endpoint} || exit 1`];
}

function getDataPath(image: string): string {
  if (image.includes("postgres")) return "/var/lib/postgresql/data";
  if (image.includes("mysql")) return "/var/lib/mysql";
  if (image.includes("mongo")) return "/data/db";
  if (image.includes("redis")) return "/data";
  return "/data";
}

// ── YAML Serializer ───────────────────────────────────────────

function serializeService(lines: string[], svc: DockerServiceDefinition, indent: number): void {
  const pad = " ".repeat(indent);

  if (svc.image) {
    lines.push(`${pad}image: ${svc.image}`);
  }

  if (svc.build) {
    lines.push(`${pad}build:`);
    lines.push(`${pad}  context: ${svc.build.context}`);
    lines.push(`${pad}  dockerfile: ${svc.build.dockerfile}`);
    if (svc.build.target) lines.push(`${pad}  target: ${svc.build.target}`);
    if (svc.build.args) {
      lines.push(`${pad}  args:`);
      for (const [k, v] of Object.entries(svc.build.args)) {
        lines.push(`${pad}    ${k}: "${v}"`);
      }
    }
  }

  if (svc.ports && svc.ports.length > 0) {
    lines.push(`${pad}ports:`);
    for (const p of svc.ports) {
      lines.push(`${pad}  - "${p.host}:${p.container}${p.protocol ? `/${p.protocol}` : ""}"`);
    }
  }

  if (svc.environment && Object.keys(svc.environment).length > 0) {
    lines.push(`${pad}environment:`);
    for (const [k, v] of Object.entries(svc.environment)) {
      lines.push(`${pad}  ${k}: "${v}"`);
    }
  }

  if (svc.envFile && svc.envFile.length > 0) {
    lines.push(`${pad}env_file:`);
    for (const f of svc.envFile) {
      lines.push(`${pad}  - ${f}`);
    }
  }

  if (svc.volumes && svc.volumes.length > 0) {
    lines.push(`${pad}volumes:`);
    for (const v of svc.volumes) {
      if (v.type === "named") {
        lines.push(`${pad}  - ${v.name}:${v.target}${v.readOnly ? ":ro" : ""}`);
      } else if (v.type === "bind") {
        lines.push(`${pad}  - ${v.source || "."}:${v.target}${v.readOnly ? ":ro" : ""}`);
      }
    }
  }

  if (svc.networks && svc.networks.length > 0) {
    lines.push(`${pad}networks:`);
    for (const n of svc.networks) {
      lines.push(`${pad}  - ${n}`);
    }
  }

  if (svc.dependsOn && Object.keys(svc.dependsOn).length > 0) {
    lines.push(`${pad}depends_on:`);
    for (const [dep, cond] of Object.entries(svc.dependsOn)) {
      lines.push(`${pad}  ${dep}:`);
      lines.push(`${pad}    condition: ${cond.condition}`);
    }
  }

  if (svc.healthcheck) {
    lines.push(`${pad}healthcheck:`);
    lines.push(`${pad}  test: [${svc.healthcheck.test.map((t) => `"${t}"`).join(", ")}]`);
    lines.push(`${pad}  interval: ${svc.healthcheck.interval}`);
    lines.push(`${pad}  timeout: ${svc.healthcheck.timeout}`);
    lines.push(`${pad}  retries: ${svc.healthcheck.retries}`);
    lines.push(`${pad}  start_period: ${svc.healthcheck.start_period}`);
  }

  if (svc.restart) {
    lines.push(`${pad}restart: ${svc.restart}`);
  }

  if (svc.deploy?.resources) {
    lines.push(`${pad}deploy:`);
    lines.push(`${pad}  resources:`);
    if (svc.deploy.resources.limits) {
      lines.push(`${pad}    limits:`);
      if (svc.deploy.resources.limits.cpus) lines.push(`${pad}      cpus: "${svc.deploy.resources.limits.cpus}"`);
      if (svc.deploy.resources.limits.memory) lines.push(`${pad}      memory: ${svc.deploy.resources.limits.memory}`);
      if (svc.deploy.resources.limits.pids) lines.push(`${pad}      pids: ${svc.deploy.resources.limits.pids}`);
    }
    if (svc.deploy.resources.reservations) {
      lines.push(`${pad}    reservations:`);
      if (svc.deploy.resources.reservations.cpus) lines.push(`${pad}      cpus: "${svc.deploy.resources.reservations.cpus}"`);
      if (svc.deploy.resources.reservations.memory) lines.push(`${pad}      memory: ${svc.deploy.resources.reservations.memory}`);
    }
  }

  if (svc.security_opt && svc.security_opt.length > 0) {
    lines.push(`${pad}security_opt:`);
    for (const opt of svc.security_opt) {
      lines.push(`${pad}  - ${opt}`);
    }
  }

  if (svc.cap_drop && svc.cap_drop.length > 0) {
    lines.push(`${pad}cap_drop:`);
    for (const cap of svc.cap_drop) {
      lines.push(`${pad}  - ${cap}`);
    }
  }

  if (svc.read_only) {
    lines.push(`${pad}read_only: true`);
  }

  if (svc.tmpfs && svc.tmpfs.length > 0) {
    lines.push(`${pad}tmpfs:`);
    for (const t of svc.tmpfs) {
      lines.push(`${pad}  - ${t}`);
    }
  }

  if (svc.user) {
    lines.push(`${pad}user: "${svc.user}"`);
  }

  if (svc.labels && Object.keys(svc.labels).length > 0) {
    lines.push(`${pad}labels:`);
    for (const [k, v] of Object.entries(svc.labels)) {
      lines.push(`${pad}  ${k}: "${v}"`);
    }
  }

  if (svc.entrypoint && svc.entrypoint.length > 0) {
    lines.push(`${pad}entrypoint: [${svc.entrypoint.map((e) => `"${e}"`).join(", ")}]`);
  }

  if (svc.command && svc.command.length > 0) {
    lines.push(`${pad}command: [${svc.command.map((c) => `"${c}"`).join(", ")}]`);
  }

  if (svc.stop_signal) {
    lines.push(`${pad}stop_signal: ${svc.stop_signal}`);
  }

  if (svc.stop_grace_period) {
    lines.push(`${pad}stop_grace_period: ${svc.stop_grace_period}`);
  }

  if (svc.working_dir) {
    lines.push(`${pad}working_dir: ${svc.working_dir}`);
  }
}
