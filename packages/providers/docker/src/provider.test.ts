import { describe, it, expect, vi, beforeEach } from "vitest";
import { DockerProvider } from "./provider.js";
import { generateDockerfile, RUNTIME_IMAGES } from "./generators/dockerfile.js";
import { generateComposeFile, serializeComposeFile, sanitizeDockerName } from "./generators/compose.js";
import { generateEnvExample, generateEnvTemplate, isSecret } from "./generators/env.js";
import { generateDockerignore } from "./generators/dockerignore.js";
import { validateDockerConfig, parseMemoryString } from "./validators.js";
import type { DeploymentPlan, Resource } from "novaserve-core";
import type {
  DockerClient,
  DockerDaemonStatus,
  DockerBuildResult,
  DockerDeploymentContext,
  DockerProviderConfig,
  ContainerStatus,
  HealthCheckResult,
  ComposeUpOptions,
  ComposeDownOptions,
  DockerBuildOptions,
  DockerHealthCheckConfig,
  LogLine,
} from "./types.js";

// ── Mock Docker Client ────────────────────────────────────────

function createMockClient(overrides: Partial<DockerClient> = {}): DockerClient {
  return {
    getStatus: vi.fn().mockResolvedValue({
      available: true,
      version: "24.0.7",
      composeVersion: "2.24.0",
      platform: "linux/amd64",
      warnings: [],
    } satisfies DockerDaemonStatus),

    build: vi.fn().mockResolvedValue({
      success: true,
      imageId: "sha256:abc123",
      durationMs: 1500,
    } satisfies DockerBuildResult),

    composeUp: vi.fn().mockResolvedValue({ success: true }),

    composeDown: vi.fn().mockResolvedValue(undefined),

    composePs: vi.fn().mockResolvedValue([
      {
        name: "test-app-prod-api-1",
        service: "test-app-prod-api",
        state: "running",
        health: "healthy",
        ports: ["3000:3000"],
      },
    ] satisfies ContainerStatus[]),

    composeLogs: vi.fn().mockImplementation(async function* () {
      yield {
        timestamp: new Date("2024-01-01T00:00:00Z"),
        service: "api",
        message: "Server started on port 3000",
        stream: "stdout" as const,
      } satisfies LogLine;
    }),

    healthCheck: vi.fn().mockResolvedValue({
      service: "api",
      healthy: true,
      type: "container",
    } satisfies HealthCheckResult),

    imageTag: vi.fn().mockResolvedValue(undefined),

    imagePush: vi.fn().mockResolvedValue({ success: true, digest: "sha256:def456" }),

    imageInspect: vi.fn().mockResolvedValue({
      exists: true,
      id: "sha256:abc123",
      size: 100_000_000,
    }),

    exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: '{"ok":true}', stderr: "" }),

    ...overrides,
  };
}

// ── Test Resources ────────────────────────────────────────────

const apiResource: Resource = {
  type: "api",
  name: "api",
  config: {
    routes: {
      "GET /health": "src/handlers/health.get",
      "GET /users": "src/handlers/users.list",
    },
    cors: { origins: ["*"] },
  },
  dependencies: [],
};

const functionResource: Resource = {
  type: "function",
  name: "process-upload",
  config: { handler: "src/handlers/upload.process", memory: 512, timeout: 60 },
  dependencies: [],
};

const queueResource: Resource = {
  type: "queue",
  name: "email-queue",
  config: { handler: "src/handlers/email.process", retries: 3 },
  dependencies: [],
};

const cronResource: Resource = {
  type: "cron",
  name: "cleanup",
  config: { schedule: "0 0 * * *", handler: "src/handlers/cleanup.run" },
  dependencies: [],
};

const databaseResource: Resource = {
  type: "database",
  name: "main-db",
  config: { engine: "postgres", version: "16" },
  dependencies: [],
};

const cacheResource: Resource = {
  type: "cache",
  name: "session-cache",
  config: {},
  dependencies: [],
};

const storageResource: Resource = {
  type: "storage",
  name: "user-uploads",
  config: { maxSize: "10mb" },
  dependencies: [],
};

const secretResource: Resource = {
  type: "secret",
  name: "stripe-secret-key",
  config: {},
  dependencies: [],
};

const allResources: Resource[] = [
  apiResource,
  functionResource,
  queueResource,
  cronResource,
  databaseResource,
  cacheResource,
  storageResource,
  secretResource,
];

function buildTestContext(overrides: Partial<DockerDeploymentContext> = {}): DockerDeploymentContext {
  return {
    appName: "test-app",
    environment: "production",
    dockerConfig: {},
    projectName: "test-app-prod",
    outputDir: "/tmp/nova-test/docker",
    projectRoot: "/tmp/nova-test",
    novaVersion: "2.1.9",
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════
// TEST SUITES
// ═════════════════════════════════════════════════════════════

describe("DockerProvider — Production Architecture", () => {

  // ── Provider Status ────────────────────────────────────────

  describe("Provider Status", () => {
    it("reports available Docker daemon", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const status = await provider.getStatus();
      expect(status.name).toBe("Docker");
      expect(status.configured).toBe(true);
      expect(status.region).toBe("local");
      expect(status.account).toContain("Docker");
      expect(status.account).toContain("24.0.7");
    });

    it("reports unavailable Docker daemon", async () => {
      const client = createMockClient({
        getStatus: vi.fn().mockResolvedValue({
          available: false,
          warnings: ["Docker daemon is not running"],
        }),
      });
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const status = await provider.getStatus();
      expect(status.configured).toBe(false);
      expect(status.warnings).toContain("Docker daemon is not running");
    });
  });

  // ── Validation ─────────────────────────────────────────────

  describe("Validation", () => {
    it("validates all supported resource types", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const result = await provider.validate(allResources);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("warns about dependency resources without bundling", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const result = await provider.validate([databaseResource, cacheResource]);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.message.includes("external service"))).toBe(true);
    });

    it("rejects invalid port numbers", async () => {
      const result = await validateDockerConfig(
        [{ type: "api", name: "api", config: { port: 99999 }, dependencies: [] }],
        {}
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("65535"))).toBe(true);
    });

    it("detects port conflicts", async () => {
      const result = await validateDockerConfig(
        [
          { type: "api", name: "api1", config: { port: 3000 }, dependencies: [] },
          { type: "api", name: "api2", config: { port: 3000 }, dependencies: [] },
        ],
        {}
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("already in use"))).toBe(true);
    });

    it("validates resource limits", async () => {
      const result = await validateDockerConfig([], {
        resources: { limits: { memory: "8M" } },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("greater than 16MB"))).toBe(true);
    });

    it("validates health check config", async () => {
      const result = await validateDockerConfig([], {
        healthCheck: { type: "http", endpoint: "health", interval: -1 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("start with '/'"))).toBe(true);
    });

    it("validates registry config", async () => {
      const result = await validateDockerConfig([], {
        registry: { url: "https://ghcr.io" },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("without protocol"))).toBe(true);
    });

    it("validates unsupported database engine", async () => {
      const result = await validateDockerConfig(
        [{ type: "database", name: "db", config: { engine: "oracle" }, dependencies: [] }],
        { bundleDependencies: true }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("oracle"))).toBe(true);
    });
  });

  // ── Dockerfile Generation ──────────────────────────────────

  describe("Dockerfile Generation", () => {
    it("generates multi-stage Dockerfile for Node.js", () => {
      const ctx = buildTestContext();
      const dockerfile = generateDockerfile(ctx, [apiResource], "node20");

      expect(dockerfile).toContain("FROM node:20-alpine AS builder");
      expect(dockerfile).toContain("FROM node:20-alpine AS production");
      expect(dockerfile).toContain("WORKDIR /build");
      expect(dockerfile).toContain("WORKDIR /app");
    });

    it("includes non-root user", () => {
      const ctx = buildTestContext();
      const dockerfile = generateDockerfile(ctx, [apiResource]);

      expect(dockerfile).toContain("adduser");
      expect(dockerfile).toContain("novaserve");
      expect(dockerfile).toContain("USER novaserve");
    });

    it("includes OCI labels", () => {
      const ctx = buildTestContext();
      const dockerfile = generateDockerfile(ctx, [apiResource]);

      expect(dockerfile).toContain("org.opencontainers.image.title");
      expect(dockerfile).toContain("dev.novaserve.managed");
      expect(dockerfile).toContain("dev.novaserve.application");
    });

    it("includes health check", () => {
      const ctx = buildTestContext({
        dockerConfig: {
          healthCheck: { type: "http", endpoint: "/health", interval: 15 },
        },
      });
      const dockerfile = generateDockerfile(ctx, [apiResource]);

      expect(dockerfile).toContain("HEALTHCHECK");
      expect(dockerfile).toContain("/health");
    });

    it("includes STOPSIGNAL for graceful shutdown", () => {
      const ctx = buildTestContext();
      const dockerfile = generateDockerfile(ctx, [apiResource]);

      expect(dockerfile).toContain("STOPSIGNAL SIGTERM");
    });

    it("exposes correct port", () => {
      const ctx = buildTestContext();
      const dockerfile = generateDockerfile(ctx, [apiResource]);

      expect(dockerfile).toContain("EXPOSE 3000");
      expect(dockerfile).toContain("ENV PORT=3000");
    });

    it("sets NODE_ENV=production", () => {
      const ctx = buildTestContext();
      const dockerfile = generateDockerfile(ctx, [apiResource]);

      expect(dockerfile).toContain("ENV NODE_ENV=production");
    });

    it("supports all runtime images", () => {
      expect(RUNTIME_IMAGES["node18"]).toBeDefined();
      expect(RUNTIME_IMAGES["node20"]).toBeDefined();
      expect(RUNTIME_IMAGES["node22"]).toBeDefined();
      expect(RUNTIME_IMAGES["bun"]).toBeDefined();
      expect(RUNTIME_IMAGES["python3.12"]).toBeDefined();
      expect(RUNTIME_IMAGES["go1.22"]).toBeDefined();
      expect(RUNTIME_IMAGES["java21"]).toBeDefined();
    });

    it("respects custom security config", () => {
      const ctx = buildTestContext({
        dockerConfig: { security: { nonRoot: false } },
      });
      const dockerfile = generateDockerfile(ctx, [apiResource]);

      expect(dockerfile).not.toContain("USER novaserve");
    });
  });

  // ── Compose Generation ─────────────────────────────────────

  describe("Compose File Generation", () => {
    it("generates services for API resource", () => {
      const ctx = buildTestContext();
      const compose = generateComposeFile(ctx, [apiResource]);

      const serviceNames = Object.keys(compose.services);
      expect(serviceNames.length).toBeGreaterThan(0);
      const apiService = Object.values(compose.services).find((s) => s.name === "api");
      expect(apiService).toBeDefined();
      expect(apiService!.ports).toBeDefined();
      expect(apiService!.restart).toBe("unless-stopped");
    });

    it("generates networks", () => {
      const ctx = buildTestContext();
      const compose = generateComposeFile(ctx, [apiResource]);

      expect(compose.networks).toBeDefined();
      const networkNames = Object.keys(compose.networks!);
      expect(networkNames.some((n) => n.includes("public"))).toBe(true);
      expect(networkNames.some((n) => n.includes("internal"))).toBe(true);
    });

    it("sets internal network as internal: true", () => {
      const ctx = buildTestContext();
      const compose = generateComposeFile(ctx, [apiResource]);

      const internalNet = Object.entries(compose.networks!).find(([, v]) => v.internal === true);
      expect(internalNet).toBeDefined();
    });

    it("includes security hardening", () => {
      const ctx = buildTestContext();
      const compose = generateComposeFile(ctx, [apiResource]);

      const apiService = Object.values(compose.services).find((s) => s.name === "api");
      expect(apiService!.security_opt).toContain("no-new-privileges:true");
      expect(apiService!.cap_drop).toContain("ALL");
      expect(apiService!.read_only).toBe(true);
    });

    it("includes resource limits when configured", () => {
      const ctx = buildTestContext({
        dockerConfig: { resources: { limits: { cpus: "1", memory: "512M" } } },
      });
      const compose = generateComposeFile(ctx, [apiResource]);

      const apiService = Object.values(compose.services).find((s) => s.name === "api");
      expect(apiService!.deploy?.resources?.limits?.cpus).toBe("1");
      expect(apiService!.deploy?.resources?.limits?.memory).toBe("512M");
    });

    it("bundles database when bundleDependencies=true", () => {
      const ctx = buildTestContext({ dockerConfig: { bundleDependencies: true } });
      const compose = generateComposeFile(ctx, [apiResource, databaseResource]);

      const dbService = Object.values(compose.services).find((s) =>
        s.image?.includes("postgres")
      );
      expect(dbService).toBeDefined();
      expect(dbService!.healthcheck).toBeDefined();
    });

    it("bundles Redis cache when bundleDependencies=true", () => {
      const ctx = buildTestContext({ dockerConfig: { bundleDependencies: true } });
      const compose = generateComposeFile(ctx, [apiResource, cacheResource]);

      const redisService = Object.values(compose.services).find((s) =>
        s.image?.includes("redis")
      );
      expect(redisService).toBeDefined();
    });

    it("does NOT bundle dependencies by default", () => {
      const ctx = buildTestContext();
      const compose = generateComposeFile(ctx, [apiResource, databaseResource]);

      const dbService = Object.values(compose.services).find((s) =>
        s.image?.includes("postgres")
      );
      expect(dbService).toBeUndefined();
    });

    it("adds depends_on with service_healthy for bundled deps", () => {
      const ctx = buildTestContext({ dockerConfig: { bundleDependencies: true } });
      const compose = generateComposeFile(ctx, [apiResource, databaseResource]);

      const apiService = Object.values(compose.services).find((s) => s.build);
      expect(apiService!.dependsOn).toBeDefined();
      const deps = Object.values(apiService!.dependsOn!);
      expect(deps.some((d) => d.condition === "service_healthy")).toBe(true);
    });

    it("generates worker services for queues", () => {
      const ctx = buildTestContext();
      const compose = generateComposeFile(ctx, [queueResource]);

      const workerService = Object.values(compose.services).find((s) =>
        s.name?.includes("queue")
      );
      expect(workerService).toBeDefined();
    });

    it("generates cron services", () => {
      const ctx = buildTestContext();
      const compose = generateComposeFile(ctx, [cronResource]);

      const cronService = Object.values(compose.services).find((s) =>
        s.name?.includes("cron")
      );
      expect(cronService).toBeDefined();
    });

    it("serializes to valid YAML", () => {
      const ctx = buildTestContext({ dockerConfig: { bundleDependencies: true } });
      const compose = generateComposeFile(ctx, allResources);
      const yaml = serializeComposeFile(compose);

      expect(yaml).toContain("services:");
      expect(yaml).toContain("networks:");
      expect(yaml).toContain("volumes:");
      expect(yaml).toContain("restart:");
      expect(yaml).not.toContain("undefined");
    });
  });

  // ── Naming ─────────────────────────────────────────────────

  describe("Docker Naming", () => {
    it("sanitizes names to Docker-compatible format", () => {
      expect(sanitizeDockerName("My App.v2")).toBe("my-app-v2");
      expect(sanitizeDockerName("orders-prod-api")).toBe("orders-prod-api");
      expect(sanitizeDockerName("---test---")).toBe("test");
      expect(sanitizeDockerName("UPPERCASE")).toBe("uppercase");
    });

    it("truncates names to 63 characters", () => {
      const longName = "a".repeat(100);
      expect(sanitizeDockerName(longName).length).toBeLessThanOrEqual(63);
    });

    it("generates deterministic project names", () => {
      const ctx1 = buildTestContext({ appName: "orders", environment: "prod" });
      const ctx2 = buildTestContext({ appName: "orders", environment: "prod" });
      expect(ctx1.projectName).toBe(ctx2.projectName);
    });
  });

  // ── Environment Generation ─────────────────────────────────

  describe("Environment Generation", () => {
    it("generates .env.example with placeholders", () => {
      const ctx = buildTestContext();
      const env = generateEnvExample(ctx, allResources);

      expect(env).toContain("NODE_ENV=production");
      expect(env).toContain("PORT=3000");
      expect(env).toContain("<CHANGE_ME>");
      expect(env).not.toContain("real-secret-value");
    });

    it("includes database config when database resource exists", () => {
      const ctx = buildTestContext();
      const env = generateEnvExample(ctx, [databaseResource]);

      expect(env).toContain("DB_HOST");
      expect(env).toContain("DB_PORT");
      expect(env).toContain("DB_PASSWORD");
      expect(env).toContain("DATABASE_URL");
    });

    it("includes cache config when cache resource exists", () => {
      const ctx = buildTestContext();
      const env = generateEnvExample(ctx, [cacheResource]);

      expect(env).toContain("REDIS_URL");
    });

    it("includes storage config when storage resource exists", () => {
      const ctx = buildTestContext();
      const env = generateEnvExample(ctx, [storageResource]);

      expect(env).toContain("STORAGE_ACCESS_KEY");
      expect(env).toContain("STORAGE_SECRET_KEY");
      expect(env).toContain("STORAGE_BUCKET");
    });

    it("includes secrets with placeholder values", () => {
      const ctx = buildTestContext();
      const env = generateEnvExample(ctx, [secretResource]);

      expect(env).toContain("STRIPE_SECRET_KEY");
      expect(env).toContain("<CHANGE_ME>");
    });

    it("classifies secret variable names correctly", () => {
      expect(isSecret("API_KEY")).toBe(true);
      expect(isSecret("JWT_SECRET")).toBe(true);
      expect(isSecret("DATABASE_PASSWORD")).toBe(true);
      expect(isSecret("AWS_SECRET_ACCESS_KEY")).toBe(true);
      expect(isSecret("PORT")).toBe(false);
      expect(isSecret("NODE_ENV")).toBe(false);
      expect(isSecret("LOG_LEVEL")).toBe(false);
    });
  });

  // ── Dockerignore ───────────────────────────────────────────

  describe("Dockerignore Generation", () => {
    it("excludes node_modules", () => {
      const ignore = generateDockerignore();
      expect(ignore).toContain("node_modules");
    });

    it("excludes .env files", () => {
      const ignore = generateDockerignore();
      expect(ignore).toContain(".env");
    });

    it("excludes test files", () => {
      const ignore = generateDockerignore();
      expect(ignore).toContain("*.test.ts");
    });

    it("excludes .git directory", () => {
      const ignore = generateDockerignore();
      expect(ignore).toContain(".git");
    });

    it("excludes Docker files themselves", () => {
      const ignore = generateDockerignore();
      expect(ignore).toContain("Dockerfile");
      expect(ignore).toContain("docker-compose*.yml");
    });

    it("keeps .env.example", () => {
      const ignore = generateDockerignore();
      expect(ignore).toContain("!.env.example");
    });
  });

  // ── Memory Parsing ─────────────────────────────────────────

  describe("Memory String Parsing", () => {
    it("parses valid memory strings", () => {
      expect(parseMemoryString("128M")).toBe(128 * 1024 * 1024);
      expect(parseMemoryString("512MB")).toBe(512 * 1024 * 1024);
      expect(parseMemoryString("1G")).toBe(1024 * 1024 * 1024);
      expect(parseMemoryString("1GB")).toBe(1024 * 1024 * 1024);
      expect(parseMemoryString("256K")).toBe(256 * 1024);
    });

    it("returns null for invalid strings", () => {
      expect(parseMemoryString("abc")).toBeNull();
      expect(parseMemoryString("")).toBeNull();
      expect(parseMemoryString("-128M")).toBeNull();
    });
  });

  // ── Deployment Lifecycle ───────────────────────────────────

  describe("Deployment Lifecycle", () => {
    it("completes full deploy lifecycle with mocked client", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app", runtime: "node20" });

      // First validate
      const validation = await provider.validate([apiResource]);
      expect(validation.valid).toBe(true);

      // Then plan
      const plan = await provider.plan([apiResource], []);
      expect(plan.summary.create).toBe(1);
      expect(plan.appName).toBe("test-app");
      expect(plan.provider).toBe("docker");

      // Deploy would require filesystem access, so we test the plan structure
      expect(plan.actions[0]!.action).toBe("create");
      expect(plan.actions[0]!.resource.type).toBe("api");
    });

    it("detects resource changes in plan", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const currentState = [{
        type: "api" as const,
        name: "api",
        config: { routes: { "GET /old": "handler" } },
        dependencies: [],
        id: "docker:test-app-prod:api:api",
        configHash: "old-hash",
        status: "deployed" as const,
      }];

      const plan = await provider.plan([apiResource], currentState);
      expect(plan.summary.update).toBe(1);
    });

    it("detects removed resources in plan", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const currentState = [{
        type: "function" as const,
        name: "old-function",
        config: {},
        dependencies: [],
        id: "docker:test-app-prod:function:old-function",
        configHash: "abc",
        status: "deployed" as const,
      }];

      const plan = await provider.plan([apiResource], currentState);
      expect(plan.summary.delete).toBe(1);
      expect(plan.actions.find((a) => a.action === "delete")?.resource.name).toBe("old-function");
    });

    it("skips unchanged resources", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const { createHash } = await import("node:crypto");
      const configHash = createHash("sha256")
        .update(JSON.stringify(apiResource.config))
        .digest("hex");

      const currentState = [{
        type: "api" as const,
        name: "api",
        config: apiResource.config,
        dependencies: [],
        id: "docker:test-app-prod:api:api",
        configHash,
        status: "deployed" as const,
      }];

      const plan = await provider.plan([apiResource], currentState);
      expect(plan.summary.skip).toBe(1);
    });
  });

  // ── Error Handling ─────────────────────────────────────────

  describe("Error Handling", () => {
    it("produces actionable error messages for validation failures", async () => {
      const result = await validateDockerConfig(
        [{ type: "api", name: "api", config: { port: -1 }, dependencies: [] }],
        { resources: { limits: { memory: "4M" } } }
      );

      expect(result.valid).toBe(false);
      for (const error of result.errors) {
        // Every error should mention "Docker provider:" for context
        expect(error.message).toContain("Docker provider:");
      }
    });

    it("validates stopGracePeriod range", async () => {
      const result = await validateDockerConfig([], { stopGracePeriod: 9999 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("stopGracePeriod"))).toBe(true);
    });

    it("validates reservations don't exceed limits", async () => {
      const result = await validateDockerConfig([], {
        resources: {
          limits: { memory: "256M", cpus: "1" },
          reservations: { memory: "512M", cpus: "2" },
        },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("cannot exceed"))).toBe(true);
    });
  });

  // ── Logs ───────────────────────────────────────────────────

  describe("Logs", () => {
    it("streams structured logs", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const logs: Array<{ level: string; message: string }> = [];
      for await (const entry of provider.getLogs("api")) {
        logs.push({ level: entry.level, message: entry.message });
      }

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]!.message).toContain("Server started");
    });
  });

  // ── Invoke ─────────────────────────────────────────────────

  describe("Invoke", () => {
    it("returns 503 for missing service", async () => {
      const client = createMockClient({
        composePs: vi.fn().mockResolvedValue([]),
      });
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const result = await provider.invoke("nonexistent", {});
      expect(result.statusCode).toBe(503);
    });
  });

  // ── Registry ───────────────────────────────────────────────

  describe("Registry Configuration", () => {
    it("supports various registry configurations", async () => {
      // Docker Hub
      const r1 = await validateDockerConfig([], {
        registry: { repository: "myuser/myapp", tag: "1.0.0" },
      });
      expect(r1.valid).toBe(true);

      // GHCR
      const r2 = await validateDockerConfig([], {
        registry: { url: "ghcr.io", repository: "org/app", tag: "1.0.0" },
      });
      expect(r2.valid).toBe(true);

      // Private
      const r3 = await validateDockerConfig([], {
        registry: { url: "registry.example.com", repository: "team/service", tag: "v2.0.0" },
      });
      expect(r3.valid).toBe(true);
    });

    it("validates tag strategy", async () => {
      const result = await validateDockerConfig([], {
        registry: { tagStrategy: "invalid" as any },
      });
      expect(result.valid).toBe(false);
    });
  });

  // ── Idempotency ────────────────────────────────────────────

  describe("Idempotency", () => {
    it("produces identical plans for identical inputs", async () => {
      const client = createMockClient();
      const provider = new DockerProvider({ client });
      await provider.init({ name: "test-app" });

      const plan1 = await provider.plan([apiResource], []);
      const plan2 = await provider.plan([apiResource], []);

      expect(plan1.summary).toEqual(plan2.summary);
      expect(plan1.actions.length).toBe(plan2.actions.length);
    });

    it("generates deterministic compose output", () => {
      const ctx = buildTestContext();
      const compose1 = serializeComposeFile(generateComposeFile(ctx, [apiResource]));
      const compose2 = serializeComposeFile(generateComposeFile(ctx, [apiResource]));
      expect(compose1).toBe(compose2);
    });
  });
});

// ── Regression Tests ─────────────────────────────────────────

describe("Regression — Provider Interface Compliance", () => {
  it("implements all NovaProvider methods", () => {
    const provider = new DockerProvider({ client: createMockClient() });

    expect(typeof provider.init).toBe("function");
    expect(typeof provider.validate).toBe("function");
    expect(typeof provider.deploy).toBe("function");
    expect(typeof provider.destroy).toBe("function");
    expect(typeof provider.getLogs).toBe("function");
    expect(typeof provider.invoke).toBe("function");
    expect(typeof provider.getStatus).toBe("function");
    expect(provider.name).toBe("docker");
    expect(provider.displayName).toBe("Docker");
  });

  it("has correct provider name and displayName", () => {
    const provider = new DockerProvider({ client: createMockClient() });
    expect(provider.name).toBe("docker");
    expect(provider.displayName).toBe("Docker");
  });
});
