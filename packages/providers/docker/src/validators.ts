/**
 * Docker Provider Validation Engine
 *
 * Production-grade configuration validation with actionable error messages.
 * Validates resources, ports, environment, security, and Docker daemon availability.
 */

import type { Resource, ValidationResult } from "novaserve-core";
import type {
  DockerProviderConfig,
  DockerClient,
  DockerResourceLimits,
  DockerHealthCheckConfig,
  DockerRegistryConfig,
} from "./types.js";

/** Resource types that generate Docker services */
const SERVICE_RESOURCE_TYPES = new Set(["api", "function", "queue", "cron"]);

/** Resource types handled as bundled dependencies */
const DEPENDENCY_RESOURCE_TYPES = new Set(["database", "cache", "storage"]);

/** Resource types handled via environment variables (no separate container) */
const ENV_RESOURCE_TYPES = new Set(["secret", "cdn", "websocket", "email", "search", "auth"]);

/**
 * Validate Docker provider configuration and resources.
 */
export async function validateDockerConfig(
  resources: Resource[],
  config: DockerProviderConfig,
  client?: DockerClient
): Promise<ValidationResult> {
  const errors: Array<{ resource: string; message: string }> = [];
  const warnings: Array<{ resource: string; message: string }> = [];

  // ── Docker Daemon Check ─────────────────────────────────
  if (client) {
    const status = await client.getStatus();
    if (!status.available) {
      errors.push({
        resource: "docker-daemon",
        message: "Docker daemon is not running or not accessible. Install Docker: https://docs.docker.com/get-docker/",
      });
    } else {
      if (!status.composeVersion) {
        warnings.push({
          resource: "docker-compose",
          message: "Docker Compose is not available. Multi-service deployments require Docker Compose.",
        });
      }
      for (const warning of status.warnings) {
        warnings.push({ resource: "docker", message: warning });
      }
    }
  }

  // ── Resource Validation ─────────────────────────────────
  const usedPorts = new Set<number>();

  for (const resource of resources) {
    // Warn about unsupported types
    if (!SERVICE_RESOURCE_TYPES.has(resource.type) &&
        !DEPENDENCY_RESOURCE_TYPES.has(resource.type) &&
        !ENV_RESOURCE_TYPES.has(resource.type)) {
      warnings.push({
        resource: resource.name,
        message: `Resource type '${resource.type}' is not natively supported by the Docker provider and will be handled via environment variables.`,
      });
    }

    // Warn about dependency resources without bundling
    if (DEPENDENCY_RESOURCE_TYPES.has(resource.type) && !config.bundleDependencies) {
      warnings.push({
        resource: resource.name,
        message: `Resource '${resource.name}' (${resource.type}) requires an external service. Set docker.bundleDependencies=true to include a local container, or configure the connection via environment variables.`,
      });
    }

    // Validate resource name
    const nameErrors = validateResourceName(resource.name);
    errors.push(...nameErrors.map((msg) => ({ resource: resource.name, message: msg })));

    // Resource-specific validation
    switch (resource.type) {
      case "api": {
        const port = (resource.config.port as number) || 3000;
        const portErrors = validatePort(port, resource.name, usedPorts);
        errors.push(...portErrors.map((msg) => ({ resource: resource.name, message: msg })));
        usedPorts.add(port);
        break;
      }

      case "function": {
        const handler = resource.config.handler as string | undefined;
        if (!handler) {
          warnings.push({
            resource: resource.name,
            message: "Function resource has no handler specified. Container will use default entrypoint.",
          });
        }
        break;
      }

      case "queue": {
        const handler = resource.config.handler as string | undefined;
        if (!handler) {
          warnings.push({
            resource: resource.name,
            message: "Queue resource has no handler specified. Container will use default entrypoint.",
          });
        }
        break;
      }

      case "database": {
        if (config.bundleDependencies) {
          const engine = (resource.config.engine as string) || "postgres";
          const supportedEngines = ["postgres", "mysql", "mongodb", "redis"];
          if (!supportedEngines.includes(engine)) {
            errors.push({
              resource: resource.name,
              message: `Docker provider: database engine '${engine}' is not supported for local bundling. Supported engines: ${supportedEngines.join(", ")}`,
            });
          }
        }
        break;
      }
    }
  }

  // ── Config Validation ───────────────────────────────────
  if (config.resources) {
    const resourceErrors = validateResourceLimits(config.resources);
    errors.push(...resourceErrors.map((msg) => ({ resource: "config.resources", message: msg })));
  }

  if (config.healthCheck) {
    const hcErrors = validateHealthCheckConfig(config.healthCheck);
    errors.push(...hcErrors.map((msg) => ({ resource: "config.healthCheck", message: msg })));
  }

  if (config.registry) {
    const regErrors = validateRegistryConfig(config.registry);
    errors.push(...regErrors.map((msg) => ({ resource: "config.registry", message: msg })));
  }

  if (config.stopGracePeriod !== undefined) {
    if (config.stopGracePeriod < 0 || config.stopGracePeriod > 600) {
      errors.push({
        resource: "config.stopGracePeriod",
        message: `Docker provider: stopGracePeriod must be between 0 and 600 seconds, got ${config.stopGracePeriod}.`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Validation Helpers ──────────────────────────────────────

function validateResourceName(name: string): string[] {
  const errors: string[] = [];

  if (!name) {
    errors.push("Docker provider: resource name cannot be empty.");
    return errors;
  }

  if (name.length > 63) {
    errors.push(`Docker provider: resource name '${name}' exceeds Docker's 63-character limit.`);
  }

  if (!/^[a-z0-9]/.test(name)) {
    errors.push(`Docker provider: resource name '${name}' must start with a lowercase letter or digit.`);
  }

  if (/[^a-z0-9-_]/.test(name)) {
    // Warning, not error — we'll sanitize it
  }

  return errors;
}

function validatePort(port: number, resourceName: string, usedPorts: Set<number>): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`Docker provider: services.${resourceName}.port must be an integer between 1 and 65535, got ${port}.`);
  }

  if (usedPorts.has(port)) {
    errors.push(`Docker provider: port ${port} is already in use by another service. Each service must use a unique host port.`);
  }

  return errors;
}

function validateResourceLimits(limits: DockerResourceLimits): string[] {
  const errors: string[] = [];

  if (limits.limits?.memory) {
    const memoryBytes = parseMemoryString(limits.limits.memory);
    if (memoryBytes === null) {
      errors.push(`Docker provider: services.resources.limits.memory '${limits.limits.memory}' is not a valid memory format. Use formats like '128M', '512M', '1G'.`);
    } else if (memoryBytes < 16 * 1024 * 1024) {
      errors.push(`Docker provider: services.resources.limits.memory must be greater than 16MB, got '${limits.limits.memory}'.`);
    }
  }

  if (limits.limits?.cpus) {
    const cpus = parseFloat(limits.limits.cpus);
    if (isNaN(cpus) || cpus <= 0 || cpus > 128) {
      errors.push(`Docker provider: services.resources.limits.cpus must be a positive number up to 128, got '${limits.limits.cpus}'.`);
    }
  }

  if (limits.limits?.pids !== undefined) {
    if (!Number.isInteger(limits.limits.pids) || limits.limits.pids < 1) {
      errors.push(`Docker provider: services.resources.limits.pids must be a positive integer, got ${limits.limits.pids}.`);
    }
  }

  if (limits.reservations?.memory) {
    const reserved = parseMemoryString(limits.reservations.memory);
    const limited = limits.limits?.memory ? parseMemoryString(limits.limits.memory) : null;

    if (reserved === null) {
      errors.push(`Docker provider: services.resources.reservations.memory '${limits.reservations.memory}' is not a valid memory format.`);
    } else if (limited !== null && reserved > limited) {
      errors.push(`Docker provider: services.resources.reservations.memory (${limits.reservations.memory}) cannot exceed limits.memory (${limits.limits?.memory}).`);
    }
  }

  if (limits.reservations?.cpus) {
    const reservedCpus = parseFloat(limits.reservations.cpus);
    const limitedCpus = limits.limits?.cpus ? parseFloat(limits.limits.cpus) : null;

    if (isNaN(reservedCpus) || reservedCpus <= 0) {
      errors.push(`Docker provider: services.resources.reservations.cpus must be a positive number, got '${limits.reservations.cpus}'.`);
    } else if (limitedCpus !== null && reservedCpus > limitedCpus) {
      errors.push(`Docker provider: services.resources.reservations.cpus (${limits.reservations.cpus}) cannot exceed limits.cpus (${limits.limits?.cpus}).`);
    }
  }

  return errors;
}

function validateHealthCheckConfig(hc: DockerHealthCheckConfig): string[] {
  const errors: string[] = [];

  if (hc.type === "http") {
    if (hc.endpoint && !hc.endpoint.startsWith("/")) {
      errors.push(`Docker provider: healthCheck.endpoint must start with '/', got '${hc.endpoint}'.`);
    }
    if (hc.port !== undefined && (hc.port < 1 || hc.port > 65535)) {
      errors.push(`Docker provider: healthCheck.port must be between 1 and 65535, got ${hc.port}.`);
    }
  }

  if (hc.interval !== undefined && (hc.interval < 1 || hc.interval > 3600)) {
    errors.push(`Docker provider: healthCheck.interval must be between 1 and 3600 seconds, got ${hc.interval}.`);
  }

  if (hc.timeout !== undefined && (hc.timeout < 1 || hc.timeout > 300)) {
    errors.push(`Docker provider: healthCheck.timeout must be between 1 and 300 seconds, got ${hc.timeout}.`);
  }

  if (hc.retries !== undefined && (hc.retries < 1 || hc.retries > 10)) {
    errors.push(`Docker provider: healthCheck.retries must be between 1 and 10, got ${hc.retries}.`);
  }

  if (hc.startPeriod !== undefined && (hc.startPeriod < 0 || hc.startPeriod > 600)) {
    errors.push(`Docker provider: healthCheck.startPeriod must be between 0 and 600 seconds, got ${hc.startPeriod}.`);
  }

  if (hc.deploymentTimeout !== undefined && (hc.deploymentTimeout < 10 || hc.deploymentTimeout > 1800)) {
    errors.push(`Docker provider: healthCheck.deploymentTimeout must be between 10 and 1800 seconds, got ${hc.deploymentTimeout}.`);
  }

  return errors;
}

function validateRegistryConfig(registry: DockerRegistryConfig): string[] {
  const errors: string[] = [];

  if (registry.url) {
    // Basic URL validation
    if (registry.url.includes(" ") || registry.url.includes("://")) {
      errors.push(`Docker provider: registry.url should be a hostname without protocol (e.g. 'ghcr.io'), got '${registry.url}'.`);
    }
  }

  if (registry.tag) {
    if (/[^a-zA-Z0-9._-]/.test(registry.tag)) {
      errors.push(`Docker provider: registry.tag '${registry.tag}' contains invalid characters. Use alphanumeric, dots, hyphens, and underscores only.`);
    }
    if (registry.tag === "latest") {
      // Warning, not error
    }
  }

  if (registry.tagStrategy) {
    const validStrategies = ["version", "git-commit", "git-tag", "timestamp", "custom"];
    if (!validStrategies.includes(registry.tagStrategy)) {
      errors.push(`Docker provider: registry.tagStrategy '${registry.tagStrategy}' is invalid. Valid strategies: ${validStrategies.join(", ")}.`);
    }
  }

  return errors;
}

// ── Memory Parsing ────────────────────────────────────────────

function parseMemoryString(memory: string): number | null {
  const match = memory.match(/^(\d+(?:\.\d+)?)\s*(b|k|kb|m|mb|g|gb|t|tb)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]!);
  const unit = (match[2] || "b").toLowerCase();

  const multipliers: Record<string, number> = {
    b: 1,
    k: 1024,
    kb: 1024,
    m: 1024 * 1024,
    mb: 1024 * 1024,
    g: 1024 * 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    t: 1024 * 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };

  const multiplier = multipliers[unit];
  if (multiplier === undefined) return null;

  return value * multiplier;
}

export { parseMemoryString };
