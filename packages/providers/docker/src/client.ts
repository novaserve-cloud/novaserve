/**
 * Docker Client — Shell-based Docker CLI Wrapper
 *
 * Executes Docker and Docker Compose commands via child_process.
 * No external npm dependencies (no dockerode).
 * Injectable for testing via DockerProviderOptions.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  DockerClient,
  DockerDaemonStatus,
  DockerBuildOptions,
  DockerBuildResult,
  ComposeUpOptions,
  ComposeDownOptions,
  ContainerStatus,
  DockerHealthCheckConfig,
  HealthCheckResult,
  LogLine,
} from "./types.js";

const execFileAsync = promisify(execFile);

/** Default timeout for Docker CLI commands (5 minutes) */
const DEFAULT_EXEC_TIMEOUT = 300_000;

/** Build timeout (15 minutes) */
const BUILD_TIMEOUT = 900_000;

/**
 * Production Docker client implementation using native Docker CLI commands.
 */
export class ShellDockerClient implements DockerClient {
  async getStatus(): Promise<DockerDaemonStatus> {
    const warnings: string[] = [];
    let version: string | undefined;
    let composeVersion: string | undefined;
    let platform: string | undefined;

    try {
      const { stdout } = await execFileAsync("docker", ["version", "--format", "{{.Server.Version}}"], {
        timeout: 10_000,
      });
      version = stdout.trim();
    } catch {
      return {
        available: false,
        warnings: ["Docker daemon is not running or not installed. Install Docker: https://docs.docker.com/get-docker/"],
      };
    }

    try {
      const { stdout } = await execFileAsync("docker", ["info", "--format", "{{.OSType}}/{{.Architecture}}"], {
        timeout: 10_000,
      });
      platform = stdout.trim();
    } catch {
      warnings.push("Could not determine Docker platform information.");
    }

    try {
      const { stdout } = await execFileAsync("docker", ["compose", "version", "--short"], {
        timeout: 10_000,
      });
      composeVersion = stdout.trim();
    } catch {
      warnings.push("Docker Compose is not available. Install: https://docs.docker.com/compose/install/");
    }

    return { available: true, version, composeVersion, platform, warnings };
  }

  async build(options: DockerBuildOptions): Promise<DockerBuildResult> {
    const startTime = Date.now();
    const args = ["build"];

    if (options.buildKit !== false) {
      // BuildKit is enabled by default
    }

    for (const tag of options.tags) {
      args.push("-t", tag);
    }

    args.push("-f", options.dockerfile);

    if (options.target) {
      args.push("--target", options.target);
    }

    if (options.platform) {
      args.push("--platform", options.platform);
    }

    if (options.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        args.push("--build-arg", `${key}=${value}`);
      }
    }

    if (options.cacheFrom) {
      for (const cache of options.cacheFrom) {
        args.push("--cache-from", cache);
      }
    }

    if (options.sbom) {
      args.push("--sbom=true");
    }

    if (options.provenance) {
      args.push("--provenance=true");
    }

    args.push(options.context);

    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (options.buildKit !== false) {
      env["DOCKER_BUILDKIT"] = "1";
    }

    try {
      const { stdout } = await execFileAsync("docker", args, {
        timeout: BUILD_TIMEOUT,
        env,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for build output
      });

      // Try to extract image ID from build output
      const imageIdMatch = stdout.match(/writing image sha256:([a-f0-9]+)/i) ||
                           stdout.match(/Successfully built ([a-f0-9]+)/i);

      return {
        success: true,
        imageId: imageIdMatch?.[1],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async composeUp(options: ComposeUpOptions): Promise<{ success: boolean; error?: string }> {
    const args = ["compose", "-f", options.composeFile, "-p", options.projectName, "up"];

    if (options.detach !== false) {
      args.push("-d");
    }

    if (options.build) {
      args.push("--build");
    }

    if (options.forceRecreate) {
      args.push("--force-recreate");
    }

    if (options.removeOrphans !== false) {
      args.push("--remove-orphans");
    }

    if (options.timeout) {
      args.push("--timeout", String(options.timeout));
    }

    try {
      await execFileAsync("docker", args, {
        timeout: DEFAULT_EXEC_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async composeDown(options: ComposeDownOptions): Promise<void> {
    const args = ["compose", "-f", options.composeFile, "-p", options.projectName, "down"];

    if (options.volumes) {
      args.push("--volumes");
    }

    if (options.removeImages) {
      args.push("--rmi", options.removeImages);
    }

    if (options.timeout) {
      args.push("--timeout", String(options.timeout));
    }

    await execFileAsync("docker", args, {
      timeout: DEFAULT_EXEC_TIMEOUT,
    });
  }

  async composePs(projectName: string, composeFile?: string): Promise<ContainerStatus[]> {
    const args = ["compose"];
    if (composeFile) {
      args.push("-f", composeFile);
    }
    args.push("-p", projectName, "ps", "--format", "json");

    try {
      const { stdout } = await execFileAsync("docker", args, { timeout: 30_000 });

      if (!stdout.trim()) return [];

      const containers: ContainerStatus[] = [];

      // Docker Compose ps --format json outputs one JSON object per line
      for (const line of stdout.trim().split("\n")) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          containers.push({
            name: parsed.Name || parsed.name || "",
            service: parsed.Service || parsed.service || "",
            state: mapContainerState(parsed.State || parsed.state || "unknown"),
            health: mapHealthStatus(parsed.Health || parsed.health),
            ports: parsePorts(parsed.Publishers || parsed.Ports || parsed.ports || []),
            uptime: parsed.Status || parsed.RunningFor || undefined,
          });
        } catch {
          // Skip unparseable lines
        }
      }

      return containers;
    } catch {
      return [];
    }
  }

  async *composeLogs(
    projectName: string,
    service?: string,
    options?: { follow?: boolean; since?: string; tail?: number; composeFile?: string }
  ): AsyncIterable<LogLine> {
    const args = ["compose"];
    if (options?.composeFile) {
      args.push("-f", options.composeFile);
    }
    args.push("-p", projectName, "logs");

    if (options?.follow) {
      args.push("--follow");
    }

    if (options?.since) {
      args.push("--since", options.since);
    }

    if (options?.tail !== undefined) {
      args.push("--tail", String(options.tail));
    }

    args.push("--timestamps");

    if (service) {
      args.push(service);
    }

    try {
      const { stdout } = await execFileAsync("docker", args, {
        timeout: options?.follow ? 0 : 30_000,
        maxBuffer: 50 * 1024 * 1024,
      });

      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        const parsed = parseLogLine(line);
        if (parsed) {
          yield parsed;
        }
      }
    } catch {
      // Command may fail if no containers running
    }
  }

  async healthCheck(
    projectName: string,
    service: string,
    config?: DockerHealthCheckConfig
  ): Promise<HealthCheckResult> {
    // First check container health status
    const containers = await this.composePs(projectName);
    const container = containers.find((c) => c.service === service);

    if (!container) {
      return {
        service,
        healthy: false,
        type: "container",
        error: `Container for service '${service}' not found`,
      };
    }

    if (container.state !== "running") {
      return {
        service,
        healthy: false,
        type: "container",
        error: `Container state is '${container.state}', expected 'running'`,
      };
    }

    // If HTTP health check is configured, try HTTP check
    if (config?.type === "http" && config.endpoint) {
      const port = config.port || 3000;
      const endpoint = config.endpoint;
      const startTime = Date.now();

      try {
        const { stdout } = await execFileAsync("docker", [
          "compose", "-p", projectName,
          "exec", "-T", service,
          "wget", "--spider", "--quiet", "--timeout=5",
          `http://localhost:${port}${endpoint}`,
        ], { timeout: 10_000 });

        return {
          service,
          healthy: true,
          type: "http",
          statusCode: 200,
          responseTimeMs: Date.now() - startTime,
        };
      } catch {
        // Try curl as fallback
        try {
          const { stdout } = await execFileAsync("docker", [
            "compose", "-p", projectName,
            "exec", "-T", service,
            "curl", "--silent", "--fail", "--max-time", "5",
            "-o", "/dev/null", "-w", "%{http_code}",
            `http://localhost:${port}${endpoint}`,
          ], { timeout: 10_000 });

          const statusCode = parseInt(stdout.trim(), 10);
          return {
            service,
            healthy: statusCode >= 200 && statusCode < 400,
            type: "http",
            statusCode,
            responseTimeMs: Date.now() - startTime,
          };
        } catch {
          return {
            service,
            healthy: false,
            type: "http",
            error: `HTTP health check failed for ${endpoint} on port ${port}`,
            responseTimeMs: Date.now() - startTime,
          };
        }
      }
    }

    // Fall back to container health status
    return {
      service,
      healthy: container.health === "healthy" || container.health === "none",
      type: "container",
    };
  }

  async imageTag(source: string, target: string): Promise<void> {
    await execFileAsync("docker", ["tag", source, target], { timeout: 30_000 });
  }

  async imagePush(image: string): Promise<{ success: boolean; digest?: string; error?: string }> {
    try {
      const { stdout } = await execFileAsync("docker", ["push", image], {
        timeout: DEFAULT_EXEC_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
      });

      const digestMatch = stdout.match(/digest:\s*(sha256:[a-f0-9]+)/i);
      return { success: true, digest: digestMatch?.[1] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async imageInspect(image: string): Promise<{ exists: boolean; id?: string; size?: number; digest?: string } | null> {
    try {
      const { stdout } = await execFileAsync("docker", [
        "image", "inspect", image, "--format",
        "{{.Id}}|{{.Size}}|{{index .RepoDigests 0}}",
      ], { timeout: 10_000 });

      const parts = stdout.trim().split("|");
      return {
        exists: true,
        id: parts[0],
        size: parts[1] ? parseInt(parts[1], 10) : undefined,
        digest: parts[2] || undefined,
      };
    } catch {
      return null;
    }
  }

  async exec(
    containerName: string,
    command: string[]
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync("docker", [
        "exec", containerName, ...command,
      ], { timeout: DEFAULT_EXEC_TIMEOUT });

      return { exitCode: 0, stdout, stderr };
    } catch (error: unknown) {
      const err = error as { code?: number; stdout?: string; stderr?: string; message?: string };
      return {
        exitCode: err.code || 1,
        stdout: err.stdout || "",
        stderr: err.stderr || err.message || String(error),
      };
    }
  }
}

// ── Helper Functions ──────────────────────────────────────────

function mapContainerState(state: string): ContainerStatus["state"] {
  const normalized = state.toLowerCase();
  if (normalized.includes("running")) return "running";
  if (normalized.includes("exited")) return "exited";
  if (normalized.includes("paused")) return "paused";
  if (normalized.includes("restarting")) return "restarting";
  if (normalized.includes("dead")) return "dead";
  if (normalized.includes("created")) return "created";
  return "exited";
}

function mapHealthStatus(health: string | undefined): ContainerStatus["health"] {
  if (!health) return undefined;
  const normalized = health.toLowerCase();
  if (normalized.includes("healthy") && !normalized.includes("unhealthy")) return "healthy";
  if (normalized.includes("unhealthy")) return "unhealthy";
  if (normalized.includes("starting")) return "starting";
  return "none";
}

function parsePorts(ports: unknown): string[] {
  if (Array.isArray(ports)) {
    return ports.map((p) => {
      if (typeof p === "string") return p;
      if (typeof p === "object" && p !== null) {
        const pub = (p as Record<string, unknown>).PublishedPort || (p as Record<string, unknown>).published;
        const tgt = (p as Record<string, unknown>).TargetPort || (p as Record<string, unknown>).target;
        if (pub && tgt) return `${pub}:${tgt}`;
      }
      return String(p);
    }).filter(Boolean);
  }
  if (typeof ports === "string") {
    return ports.split(",").map((p) => p.trim()).filter(Boolean);
  }
  return [];
}

function parseLogLine(line: string): LogLine | null {
  // Format: "service-name  | 2024-01-01T00:00:00.000Z message"
  // or:    "service-name_1 | 2024-01-01T00:00:00.000Z message"
  const match = line.match(/^([^\s|]+)\s*\|\s*(\S+)\s+(.*)/);
  if (match) {
    const [, service, timestamp, message] = match;
    return {
      timestamp: new Date(timestamp!),
      service: service!.replace(/_\d+$/, ""),
      message: message!,
      stream: line.toLowerCase().includes("error") ? "stderr" : "stdout",
    };
  }

  // Fallback: just timestamp + message
  const fallback = line.match(/^(\S+)\s+(.*)/);
  if (fallback) {
    return {
      timestamp: new Date(fallback[1]!),
      service: "unknown",
      message: fallback[2]!,
    };
  }

  return null;
}
