/**
 * Health Check System — Deployment Health Verification
 *
 * Implements startup, liveness, and readiness checks for Docker deployments.
 * Deployment is not marked successful until health verification passes.
 */

import type {
  DockerClient,
  DockerHealthCheckConfig,
  HealthCheckResult,
  ContainerStatus,
} from "./types.js";

export interface DeploymentHealthResult {
  /** Whether all services are healthy */
  healthy: boolean;
  /** Individual service results */
  services: HealthCheckResult[];
  /** Total health check duration in ms */
  durationMs: number;
  /** Summary message */
  message: string;
}

/**
 * Wait for all services in a deployment to become healthy.
 * Returns when all services are healthy or timeout expires.
 */
export async function waitForDeploymentHealth(
  client: DockerClient,
  projectName: string,
  serviceNames: string[],
  config: DockerHealthCheckConfig = {},
  composeFile?: string
): Promise<DeploymentHealthResult> {
  const startTime = Date.now();
  const timeout = (config.deploymentTimeout || 120) * 1000; // Convert to ms
  const pollInterval = Math.min((config.interval || 15) * 1000, 5000); // Max 5s poll
  const results: Map<string, HealthCheckResult> = new Map();

  while (Date.now() - startTime < timeout) {
    const containers = await client.composePs(projectName, composeFile);

    let allHealthy = true;
    let allRunning = true;

    for (const serviceName of serviceNames) {
      const container = containers.find((c) => c.service === serviceName || c.name.includes(serviceName));

      if (!container) {
        allHealthy = false;
        allRunning = false;
        results.set(serviceName, {
          service: serviceName,
          healthy: false,
          type: "container",
          error: "Container not found",
        });
        continue;
      }

      if (container.state !== "running") {
        allHealthy = false;
        allRunning = false;
        results.set(serviceName, {
          service: serviceName,
          healthy: false,
          type: "container",
          error: `Container state: ${container.state}`,
        });
        continue;
      }

      // Check container health status
      if (container.health === "unhealthy") {
        allHealthy = false;
        results.set(serviceName, {
          service: serviceName,
          healthy: false,
          type: "container",
          error: "Container health check reports unhealthy",
        });
        continue;
      }

      if (container.health === "starting") {
        allHealthy = false;
        results.set(serviceName, {
          service: serviceName,
          healthy: false,
          type: "container",
          error: "Container health check still starting",
        });
        continue;
      }

      // Container is running and healthy (or has no health check)
      const healthResult = await client.healthCheck(projectName, serviceName, config);
      results.set(serviceName, healthResult);

      if (!healthResult.healthy) {
        allHealthy = false;
      }
    }

    if (allHealthy && serviceNames.length > 0) {
      return {
        healthy: true,
        services: Array.from(results.values()),
        durationMs: Date.now() - startTime,
        message: `All ${serviceNames.length} service(s) healthy`,
      };
    }

    // If containers are crashing (not running), fail fast
    if (!allRunning) {
      const crashedServices = Array.from(results.entries())
        .filter(([, r]) => r.error?.includes("Container state:"))
        .map(([name]) => name);

      if (crashedServices.length > 0) {
        // Check if they've been failing for a while
        const elapsed = Date.now() - startTime;
        if (elapsed > 30_000) {
          // 30 seconds of non-running containers = fail
          return {
            healthy: false,
            services: Array.from(results.values()),
            durationMs: elapsed,
            message: `Services failed to start: ${crashedServices.join(", ")}`,
          };
        }
      }
    }

    // Wait before polling again
    await sleep(pollInterval);
  }

  // Timeout expired
  const unhealthy = Array.from(results.entries())
    .filter(([, r]) => !r.healthy)
    .map(([name]) => name);

  return {
    healthy: false,
    services: Array.from(results.values()),
    durationMs: Date.now() - startTime,
    message: `Health check timeout (${config.deploymentTimeout || 120}s). Unhealthy services: ${unhealthy.join(", ")}`,
  };
}

/**
 * Perform a one-time health check for a specific service.
 */
export async function checkServiceHealth(
  client: DockerClient,
  projectName: string,
  serviceName: string,
  config?: DockerHealthCheckConfig
): Promise<HealthCheckResult> {
  return client.healthCheck(projectName, serviceName, config);
}

/**
 * Check if all containers in a project are at least running.
 */
export async function checkContainersRunning(
  client: DockerClient,
  projectName: string,
  expectedServices: string[],
  composeFile?: string
): Promise<{ allRunning: boolean; statuses: ContainerStatus[]; missing: string[] }> {
  const containers = await client.composePs(projectName, composeFile);

  const missing: string[] = [];
  for (const service of expectedServices) {
    const found = containers.find((c) => c.service === service || c.name.includes(service));
    if (!found) {
      missing.push(service);
    }
  }

  const allRunning = missing.length === 0 &&
    containers.every((c) => c.state === "running");

  return { allRunning, statuses: containers, missing };
}

// ── Helpers ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
