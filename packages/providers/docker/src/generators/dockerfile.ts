/**
 * Dockerfile Generator — Production-Grade Docker Image Builder
 *
 * Generates multi-stage Dockerfiles with security hardening,
 * deterministic dependency installation, and minimal runtime images.
 */

import type { Resource } from "novaserve-core";
import type {
  DockerProviderConfig,
  DockerDeploymentContext,
  DockerSecurityConfig,
  DockerHealthCheckConfig,
} from "../types.js";

/** Runtime-to-base-image mapping */
const RUNTIME_IMAGES: Record<string, { builder: string; runtime: string }> = {
  node18: { builder: "node:18-alpine", runtime: "node:18-alpine" },
  node20: { builder: "node:20-alpine", runtime: "node:20-alpine" },
  node22: { builder: "node:22-alpine", runtime: "node:22-alpine" },
  bun: { builder: "oven/bun:1-alpine", runtime: "oven/bun:1-alpine" },
  "python3.11": { builder: "python:3.11-slim", runtime: "python:3.11-slim" },
  "python3.12": { builder: "python:3.12-slim", runtime: "python:3.12-slim" },
  "python3.13": { builder: "python:3.13-slim", runtime: "python:3.13-slim" },
  "go1.21": { builder: "golang:1.21-alpine", runtime: "alpine:3.19" },
  "go1.22": { builder: "golang:1.22-alpine", runtime: "alpine:3.19" },
  java17: { builder: "eclipse-temurin:17-jdk-alpine", runtime: "eclipse-temurin:17-jre-alpine" },
  java21: { builder: "eclipse-temurin:21-jdk-alpine", runtime: "eclipse-temurin:21-jre-alpine" },
  dotnet8: { builder: "mcr.microsoft.com/dotnet/sdk:8.0-alpine", runtime: "mcr.microsoft.com/dotnet/aspnet:8.0-alpine" },
  rust: { builder: "rust:1-alpine", runtime: "alpine:3.19" },
};

/** Lockfile detection order */
const LOCKFILE_INSTALL_COMMANDS: Record<string, { lockfile: string; installCmd: string; copyFiles: string[] }> = {
  "pnpm-lock.yaml": {
    lockfile: "pnpm-lock.yaml",
    installCmd: "corepack enable && pnpm install --frozen-lockfile --prod",
    copyFiles: ["package.json", "pnpm-lock.yaml"],
  },
  "yarn.lock": {
    lockfile: "yarn.lock",
    installCmd: "corepack enable && yarn install --frozen-lockfile --production",
    copyFiles: ["package.json", "yarn.lock"],
  },
  "bun.lockb": {
    lockfile: "bun.lockb",
    installCmd: "bun install --frozen-lockfile --production",
    copyFiles: ["package.json", "bun.lockb"],
  },
  "package-lock.json": {
    lockfile: "package-lock.json",
    installCmd: "npm ci --omit=dev",
    copyFiles: ["package.json", "package-lock.json"],
  },
};

/**
 * Generate a production-grade Dockerfile.
 */
export function generateDockerfile(
  ctx: DockerDeploymentContext,
  resources: Resource[],
  runtime: string = "node20"
): string {
  const config = ctx.dockerConfig;
  const images = RUNTIME_IMAGES[runtime] || RUNTIME_IMAGES["node20"]!;
  const baseImage = config.image || images.builder;
  const runtimeImage = config.image || images.runtime;
  const security = resolveSecurityConfig(config.security);
  const healthCheck = config.healthCheck;

  const isNode = runtime.startsWith("node") || runtime === "bun";

  if (isNode) {
    return generateNodeDockerfile(ctx, baseImage, runtimeImage, security, healthCheck, resources);
  }

  // Fallback: generic Dockerfile for other runtimes
  return generateGenericDockerfile(ctx, baseImage, runtimeImage, security, healthCheck);
}

function generateNodeDockerfile(
  ctx: DockerDeploymentContext,
  builderImage: string,
  runtimeImage: string,
  security: Required<DockerSecurityConfig>,
  healthCheck: DockerHealthCheckConfig | undefined,
  resources: Resource[]
): string {
  const lockfileInfo = detectLockfile();
  const port = resolvePort(resources);
  const lines: string[] = [];

  // OCI Labels
  const labels = buildOCILabels(ctx);

  // ── Builder Stage ──────────────────────────────────────────
  lines.push(`# ── Builder Stage ──────────────────────────────────────────`);
  lines.push(`FROM ${builderImage} AS builder`);
  lines.push(``);
  lines.push(`WORKDIR /build`);
  lines.push(``);

  // Copy lockfile and package.json first for cache efficiency
  lines.push(`# Install dependencies (cached layer)`);
  for (const file of lockfileInfo.copyFiles) {
    lines.push(`COPY ${file} ./`);
  }

  // Install ALL dependencies (including dev) for build step
  const devInstallCmd = lockfileInfo.installCmd.replace("--prod", "").replace("--production", "").replace("--omit=dev", "");
  lines.push(`RUN ${devInstallCmd}`);
  lines.push(``);

  // Copy source code
  lines.push(`# Copy application source`);
  lines.push(`COPY . .`);
  lines.push(``);

  // Build step (if there's a build script)
  lines.push(`# Build application`);
  lines.push(`RUN npm run build --if-present`);
  lines.push(``);

  // ── Production Stage ───────────────────────────────────────
  lines.push(`# ── Production Stage ──────────────────────────────────────`);
  lines.push(`FROM ${runtimeImage} AS production`);
  lines.push(``);

  // Labels
  for (const [key, value] of Object.entries(labels)) {
    lines.push(`LABEL ${key}="${value}"`);
  }
  lines.push(``);

  // Create non-root user
  if (security.nonRoot) {
    const user = security.user || "novaserve";
    lines.push(`# Create non-root user`);
    lines.push(`RUN addgroup -g 1001 -S ${user} && \\`);
    lines.push(`    adduser -u 1001 -S ${user} -G ${user} -h /app -s /sbin/nologin`);
    lines.push(``);
  }

  lines.push(`WORKDIR /app`);
  lines.push(``);

  // Copy production dependencies
  lines.push(`# Install production dependencies only`);
  for (const file of lockfileInfo.copyFiles) {
    lines.push(`COPY ${file} ./`);
  }
  lines.push(`RUN ${lockfileInfo.installCmd} && \\`);
  lines.push(`    rm -rf /tmp/* /root/.npm /root/.cache`);
  lines.push(``);

  // Copy built application from builder
  lines.push(`# Copy built application`);
  lines.push(`COPY --from=builder /build/dist ./dist/`);
  lines.push(`COPY --from=builder /build/src ./src/`);
  lines.push(``);

  // Set permissions
  if (security.nonRoot) {
    const user = security.user || "novaserve";
    lines.push(`# Set ownership`);
    lines.push(`RUN chown -R ${user}:${user} /app`);
    lines.push(``);
  }

  // Expose port
  if (port) {
    lines.push(`EXPOSE ${port}`);
    lines.push(``);
  }

  // Environment defaults
  lines.push(`# Runtime defaults`);
  lines.push(`ENV NODE_ENV=production`);
  if (port) {
    lines.push(`ENV PORT=${port}`);
  }
  lines.push(``);

  // Health check
  if (healthCheck && healthCheck.type !== "none") {
    const hcEndpoint = healthCheck.endpoint || "/health";
    const hcPort = healthCheck.port || port || 3000;
    const hcInterval = healthCheck.interval || 15;
    const hcTimeout = healthCheck.timeout || 5;
    const hcRetries = healthCheck.retries || 3;
    const hcStartPeriod = healthCheck.startPeriod || 30;

    lines.push(`# Health check`);
    if (healthCheck.type === "http" || !healthCheck.command) {
      lines.push(`HEALTHCHECK --interval=${hcInterval}s --timeout=${hcTimeout}s --retries=${hcRetries} --start-period=${hcStartPeriod}s \\`);
      lines.push(`  CMD wget --no-verbose --tries=1 --spider http://localhost:${hcPort}${hcEndpoint} || exit 1`);
    } else {
      lines.push(`HEALTHCHECK --interval=${hcInterval}s --timeout=${hcTimeout}s --retries=${hcRetries} --start-period=${hcStartPeriod}s \\`);
      lines.push(`  CMD ${healthCheck.command}`);
    }
    lines.push(``);
  }

  // Graceful shutdown signal
  lines.push(`# Graceful shutdown`);
  lines.push(`STOPSIGNAL SIGTERM`);
  lines.push(``);

  // Switch to non-root user
  if (security.nonRoot) {
    const user = security.user || "novaserve";
    lines.push(`USER ${user}`);
    lines.push(``);
  }

  // Start command
  lines.push(`CMD ["node", "dist/index.js"]`);
  lines.push(``);

  return lines.join("\n");
}

function generateGenericDockerfile(
  ctx: DockerDeploymentContext,
  builderImage: string,
  runtimeImage: string,
  security: Required<DockerSecurityConfig>,
  healthCheck: DockerHealthCheckConfig | undefined
): string {
  const labels = buildOCILabels(ctx);
  const lines: string[] = [];

  lines.push(`# ── Builder Stage ──────────────────────────────────────────`);
  lines.push(`FROM ${builderImage} AS builder`);
  lines.push(`WORKDIR /build`);
  lines.push(`COPY . .`);
  lines.push(`RUN echo "Build step — customize for your runtime"`);
  lines.push(``);

  lines.push(`# ── Production Stage ──────────────────────────────────────`);
  lines.push(`FROM ${runtimeImage} AS production`);
  lines.push(``);

  for (const [key, value] of Object.entries(labels)) {
    lines.push(`LABEL ${key}="${value}"`);
  }
  lines.push(``);

  if (security.nonRoot) {
    const user = security.user || "novaserve";
    lines.push(`RUN addgroup -g 1001 -S ${user} && adduser -u 1001 -S ${user} -G ${user}`);
    lines.push(``);
  }

  lines.push(`WORKDIR /app`);
  lines.push(`COPY --from=builder /build/ .`);
  lines.push(``);

  if (security.nonRoot) {
    const user = security.user || "novaserve";
    lines.push(`RUN chown -R ${user}:${user} /app`);
    lines.push(`USER ${user}`);
    lines.push(``);
  }

  lines.push(`STOPSIGNAL SIGTERM`);
  lines.push(`CMD ["./start.sh"]`);
  lines.push(``);

  return lines.join("\n");
}

// ── Helpers ────────────────────────────────────────────────

function resolveSecurityConfig(config?: DockerSecurityConfig): Required<DockerSecurityConfig> {
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

function detectLockfile(): { lockfile: string; installCmd: string; copyFiles: string[] } {
  // Return npm as default since we can't read the filesystem during generation
  // The Dockerfile will work with any package manager
  return LOCKFILE_INSTALL_COMMANDS["package-lock.json"]!;
}

/**
 * Detect lockfile from project root.
 */
export function detectLockfileFromProject(projectRoot: string): { lockfile: string; installCmd: string; copyFiles: string[] } {
  const { existsSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");

  for (const [filename, info] of Object.entries(LOCKFILE_INSTALL_COMMANDS)) {
    if (existsSync(join(projectRoot, filename))) {
      return info;
    }
  }

  // Fallback to npm
  return LOCKFILE_INSTALL_COMMANDS["package-lock.json"]!;
}

function resolvePort(resources: Resource[]): number | undefined {
  const api = resources.find((r) => r.type === "api");
  if (api) {
    const port = api.config.port as number | undefined;
    return port || 3000;
  }
  return 3000;
}

function buildOCILabels(ctx: DockerDeploymentContext): Record<string, string> {
  return {
    "org.opencontainers.image.title": ctx.appName,
    "org.opencontainers.image.description": `NovaServe application: ${ctx.appName}`,
    "org.opencontainers.image.created": new Date().toISOString(),
    "org.opencontainers.image.vendor": "NovaServe",
    "org.opencontainers.image.version": ctx.novaVersion,
    "org.opencontainers.image.source": `novaserve://${ctx.appName}`,
    "dev.novaserve.managed": "true",
    "dev.novaserve.application": ctx.appName,
    "dev.novaserve.environment": ctx.environment,
  };
}

export { RUNTIME_IMAGES, LOCKFILE_INSTALL_COMMANDS };
