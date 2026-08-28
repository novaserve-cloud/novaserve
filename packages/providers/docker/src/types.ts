/**
 * Docker Provider — Centralized Type Definitions
 *
 * Shared interfaces and types used across the Docker provider,
 * artifact generators, resource mapper, and deployment lifecycle.
 */

// ── Provider Options ──────────────────────────────────────────

export interface DockerProviderOptions {
  /** Injectable Docker client for testing */
  client?: DockerClient;
  /** Clock override for deterministic tests */
  now?: () => Date;
}

// ── Provider Configuration ────────────────────────────────────

export interface DockerProviderConfig {
  /** Base image override (default: inferred from runtime) */
  image?: string;
  /** Container registry configuration */
  registry?: DockerRegistryConfig;
  /** Default resource limits for all services */
  resources?: DockerResourceLimits;
  /** Security hardening settings */
  security?: DockerSecurityConfig;
  /** Health check configuration */
  healthCheck?: DockerHealthCheckConfig;
  /** Build configuration */
  build?: DockerBuildConfig;
  /** Logging configuration */
  logging?: DockerLoggingConfig;
  /** Force Docker Compose mode even for single services */
  compose?: boolean;
  /** Docker Compose project name override */
  projectName?: string;
  /** Network configuration */
  network?: DockerNetworkConfig;
  /** Bundle dependency services locally (default: false — expects external) */
  bundleDependencies?: boolean;
  /** Graceful shutdown timeout in seconds (default: 30) */
  stopGracePeriod?: number;
  /** Restart policy (default: "unless-stopped") */
  restartPolicy?: DockerRestartPolicy;
  /** Deployment stage label (default: "production") */
  stage?: string;
}

// ── Registry ──────────────────────────────────────────────────

export interface DockerRegistryConfig {
  /** Registry URL (e.g. "ghcr.io", "registry.example.com") */
  url?: string;
  /** Repository path (e.g. "organization/application") */
  repository?: string;
  /** Image tag (e.g. "1.0.0", "latest"). Defaults to app version or git commit. */
  tag?: string;
  /** Tag strategy for automatic tagging */
  tagStrategy?: "version" | "git-commit" | "git-tag" | "timestamp" | "custom";
  /** Push image to registry after build */
  push?: boolean;
}

// ── Resource Limits ───────────────────────────────────────────

export interface DockerResourceLimits {
  limits?: {
    /** CPU limit (e.g. "1", "0.5", "2") */
    cpus?: string;
    /** Memory limit (e.g. "512M", "1G", "256M") */
    memory?: string;
    /** Max PIDs */
    pids?: number;
  };
  reservations?: {
    /** Reserved CPUs */
    cpus?: string;
    /** Reserved memory */
    memory?: string;
  };
}

// ── Security ──────────────────────────────────────────────────

export interface DockerSecurityConfig {
  /** Run as non-root user (default: true) */
  nonRoot?: boolean;
  /** Custom user/group (default: "novaserve:novaserve", UID 1001) */
  user?: string;
  /** Read-only root filesystem (default: true where compatible) */
  readOnlyRootFilesystem?: boolean;
  /** Drop all Linux capabilities (default: true) */
  dropCapabilities?: boolean;
  /** Enable no-new-privileges (default: true) */
  noNewPrivileges?: boolean;
  /** Writable tmpfs mounts (default: ["/tmp"]) */
  tmpfsMounts?: string[];
  /** Additional writable directories */
  writablePaths?: string[];
}

// ── Health Checks ─────────────────────────────────────────────

export interface DockerHealthCheckConfig {
  /** Health check type */
  type?: "http" | "cmd" | "none";
  /** HTTP endpoint for health check (default: "/health") */
  endpoint?: string;
  /** Custom command for health check */
  command?: string;
  /** Port for HTTP health checks (default: service port) */
  port?: number;
  /** Check interval in seconds (default: 15) */
  interval?: number;
  /** Timeout per check in seconds (default: 5) */
  timeout?: number;
  /** Retries before unhealthy (default: 3) */
  retries?: number;
  /** Start period in seconds before first check (default: 30) */
  startPeriod?: number;
  /** Readiness endpoint (optional, default: "/ready") */
  readinessEndpoint?: string;
  /** Maximum time to wait for health before deployment fails (seconds, default: 120) */
  deploymentTimeout?: number;
}

// ── Build ─────────────────────────────────────────────────────

export interface DockerBuildConfig {
  /** Build context path (default: project root) */
  context?: string;
  /** Dockerfile path (default: auto-generated) */
  dockerfilePath?: string;
  /** Target build stage */
  target?: string;
  /** Build arguments */
  args?: Record<string, string>;
  /** Use BuildKit (default: true) */
  buildKit?: boolean;
  /** Cache-from images */
  cacheFrom?: string[];
  /** Cache-to destination */
  cacheTo?: string;
  /** Platform target (e.g. "linux/amd64") */
  platform?: string;
  /** Include SBOM in build (default: false) */
  sbom?: boolean;
  /** Include provenance attestation (default: false) */
  provenance?: boolean;
}

// ── Networking ────────────────────────────────────────────────

export interface DockerNetworkConfig {
  /** Create internal (backend) network (default: true) */
  internal?: boolean;
  /** Create public (API-facing) network (default: true) */
  public?: boolean;
  /** Custom network names */
  networkNames?: {
    internal?: string;
    public?: string;
  };
  /** Enable IPv6 (default: false) */
  ipv6?: boolean;
}

// ── Volumes ───────────────────────────────────────────────────

export interface DockerVolumeConfig {
  /** Volume name */
  name: string;
  /** Volume type */
  type: "named" | "bind" | "external";
  /** Source path (for bind mounts) */
  source?: string;
  /** Target path inside the container */
  target: string;
  /** Read-only mount */
  readOnly?: boolean;
  /** Volume driver */
  driver?: string;
  /** Driver options */
  driverOpts?: Record<string, string>;
}

// ── Logging ───────────────────────────────────────────────────

export interface DockerLoggingConfig {
  /** Log driver (default: "json-file") */
  driver?: string;
  /** Log driver options */
  options?: Record<string, string>;
  /** Default log level (default: "info") */
  level?: "debug" | "info" | "warn" | "error";
  /** Enable structured JSON logging (default: true) */
  structured?: boolean;
}

// ── Deployment Metadata ───────────────────────────────────────

export interface DockerDeploymentMetadata {
  /** Application name */
  appName: string;
  /** Environment/stage */
  environment: string;
  /** Image tag */
  imageTag: string;
  /** Full image reference (registry/repo:tag) */
  imageRef: string;
  /** Build timestamp ISO */
  buildTimestamp: string;
  /** NovaServe version */
  novaVersion: string;
  /** Git commit hash (if available) */
  gitCommit?: string;
  /** Git branch (if available) */
  gitBranch?: string;
  /** Image digest (if available) */
  imageDigest?: string;
  /** Compose project name */
  projectName: string;
}

// ── Restart Policy ────────────────────────────────────────────

export type DockerRestartPolicy =
  | "no"
  | "always"
  | "on-failure"
  | "unless-stopped";

// ── Docker Client Interfaces ──────────────────────────────────

export interface DockerDaemonStatus {
  /** Whether the Docker daemon is running and accessible */
  available: boolean;
  /** Docker version */
  version?: string;
  /** Docker Compose version */
  composeVersion?: string;
  /** Docker OS/Arch */
  platform?: string;
  /** Warnings */
  warnings: string[];
}

export interface DockerBuildOptions {
  /** Path to Dockerfile */
  dockerfile: string;
  /** Build context directory */
  context: string;
  /** Image tag(s) */
  tags: string[];
  /** Build arguments */
  buildArgs?: Record<string, string>;
  /** Target stage */
  target?: string;
  /** Use BuildKit */
  buildKit?: boolean;
  /** Platform */
  platform?: string;
  /** Cache-from */
  cacheFrom?: string[];
  /** Enable SBOM */
  sbom?: boolean;
  /** Enable provenance */
  provenance?: boolean;
}

export interface DockerBuildResult {
  /** Whether the build succeeded */
  success: boolean;
  /** Image ID */
  imageId?: string;
  /** Image digest */
  digest?: string;
  /** Build duration in ms */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

export interface ComposeUpOptions {
  /** Path to compose file */
  composeFile: string;
  /** Project name */
  projectName: string;
  /** Run detached */
  detach?: boolean;
  /** Build before up */
  build?: boolean;
  /** Force recreate */
  forceRecreate?: boolean;
  /** Remove orphans */
  removeOrphans?: boolean;
  /** Timeout for waiting */
  timeout?: number;
}

export interface ComposeDownOptions {
  /** Path to compose file */
  composeFile: string;
  /** Project name */
  projectName: string;
  /** Remove volumes */
  volumes?: boolean;
  /** Remove images ("local" | "all") */
  removeImages?: "local" | "all";
  /** Timeout */
  timeout?: number;
}

export interface ContainerStatus {
  /** Container name */
  name: string;
  /** Service name */
  service: string;
  /** Container state */
  state: "running" | "exited" | "paused" | "restarting" | "dead" | "created";
  /** Health status */
  health?: "healthy" | "unhealthy" | "starting" | "none";
  /** Mapped ports */
  ports: string[];
  /** Uptime */
  uptime?: string;
}

export interface HealthCheckResult {
  /** Service name */
  service: string;
  /** Whether the service is healthy */
  healthy: boolean;
  /** Health check type used */
  type: "http" | "container" | "none";
  /** HTTP status code (if HTTP check) */
  statusCode?: number;
  /** Response time in ms */
  responseTimeMs?: number;
  /** Error message if unhealthy */
  error?: string;
}

export interface LogLine {
  /** Timestamp */
  timestamp: Date;
  /** Service name */
  service: string;
  /** Log message */
  message: string;
  /** Stream (stdout/stderr) */
  stream?: "stdout" | "stderr";
}

// ── Docker Client Interface ──────────────────────────────────

export interface DockerClient {
  /** Check Docker daemon status */
  getStatus(): Promise<DockerDaemonStatus>;

  /** Build a Docker image */
  build(options: DockerBuildOptions): Promise<DockerBuildResult>;

  /** Start services with Docker Compose */
  composeUp(options: ComposeUpOptions): Promise<{ success: boolean; error?: string }>;

  /** Stop and remove services with Docker Compose */
  composeDown(options: ComposeDownOptions): Promise<void>;

  /** List running containers for a compose project */
  composePs(projectName: string, composeFile?: string): Promise<ContainerStatus[]>;

  /** Stream logs from compose services */
  composeLogs(
    projectName: string,
    service?: string,
    options?: { follow?: boolean; since?: string; tail?: number; composeFile?: string }
  ): AsyncIterable<LogLine>;

  /** Check health of a specific service */
  healthCheck(projectName: string, service: string, config?: DockerHealthCheckConfig): Promise<HealthCheckResult>;

  /** Tag an image */
  imageTag(source: string, target: string): Promise<void>;

  /** Push an image to registry */
  imagePush(image: string): Promise<{ success: boolean; digest?: string; error?: string }>;

  /** Inspect an image */
  imageInspect(image: string): Promise<{ exists: boolean; id?: string; size?: number; digest?: string } | null>;

  /** Execute a command in a running container */
  exec(containerName: string, command: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

// ── Service Definition (internal) ─────────────────────────────

export interface DockerServiceDefinition {
  /** Service name */
  name: string;
  /** Image reference */
  image?: string;
  /** Build context (if building locally) */
  build?: {
    context: string;
    dockerfile: string;
    target?: string;
    args?: Record<string, string>;
  };
  /** Port mappings */
  ports?: Array<{ host: number; container: number; protocol?: "tcp" | "udp" }>;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Environment file paths */
  envFile?: string[];
  /** Volume mounts */
  volumes?: DockerVolumeConfig[];
  /** Networks to join */
  networks?: string[];
  /** Dependencies */
  dependsOn?: Record<string, { condition: string }>;
  /** Health check */
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
    start_period: string;
  };
  /** Restart policy */
  restart?: DockerRestartPolicy;
  /** Resource limits */
  deploy?: {
    resources?: DockerResourceLimits;
  };
  /** Security options */
  security_opt?: string[];
  /** Capability drops */
  cap_drop?: string[];
  /** Read-only root filesystem */
  read_only?: boolean;
  /** tmpfs mounts */
  tmpfs?: string[];
  /** User */
  user?: string;
  /** Labels */
  labels?: Record<string, string>;
  /** Entrypoint override */
  entrypoint?: string[];
  /** Command override */
  command?: string[];
  /** Stop signal */
  stop_signal?: string;
  /** Stop grace period */
  stop_grace_period?: string;
  /** Working directory */
  working_dir?: string;
}

// ── Compose File Structure ────────────────────────────────────

export interface ComposeFile {
  /** Compose services */
  services: Record<string, DockerServiceDefinition>;
  /** Network definitions */
  networks?: Record<string, { driver?: string; internal?: boolean; enable_ipv6?: boolean; labels?: Record<string, string> }>;
  /** Volume definitions */
  volumes?: Record<string, { driver?: string; driver_opts?: Record<string, string>; external?: boolean; labels?: Record<string, string> }>;
}

// ── Deployment Context ────────────────────────────────────────

export interface DockerDeploymentContext {
  /** Application name from nova.config.ts */
  appName: string;
  /** Target environment */
  environment: string;
  /** Docker-specific config from nova.config.ts */
  dockerConfig: DockerProviderConfig;
  /** Resolved project name for Docker Compose */
  projectName: string;
  /** Output directory for generated artifacts */
  outputDir: string;
  /** Project root directory */
  projectRoot: string;
  /** NovaServe version */
  novaVersion: string;
}
