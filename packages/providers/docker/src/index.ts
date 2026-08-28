/**
 * novaserve-provider-docker
 *
 * Production-grade Docker container builder and Docker Compose provider for NovaServe.
 * Containerizes NovaServe serverless handlers into production Docker deployments
 * for local, on-premise, VPS, private cloud, and CI/CD environments.
 */

// Provider
export { DockerProvider } from "./provider.js";

// Types
export type {
  DockerProviderConfig,
  DockerProviderOptions,
  DockerRegistryConfig,
  DockerResourceLimits,
  DockerSecurityConfig,
  DockerHealthCheckConfig,
  DockerBuildConfig,
  DockerNetworkConfig,
  DockerVolumeConfig,
  DockerLoggingConfig,
  DockerDeploymentMetadata,
  DockerDeploymentContext,
  DockerRestartPolicy,
  DockerClient,
  DockerDaemonStatus,
  DockerBuildOptions,
  DockerBuildResult,
  ComposeUpOptions,
  ComposeDownOptions,
  ContainerStatus,
  HealthCheckResult,
  LogLine,
  DockerServiceDefinition,
  ComposeFile,
} from "./types.js";

// Client
export { ShellDockerClient } from "./client.js";

// Generators
export { generateDockerfile, RUNTIME_IMAGES } from "./generators/dockerfile.js";
export { generateComposeFile, serializeComposeFile, sanitizeDockerName } from "./generators/compose.js";
export { generateEnvExample, generateEnvTemplate, isSecret } from "./generators/env.js";
export { generateDockerignore } from "./generators/dockerignore.js";

// Validators
export { validateDockerConfig } from "./validators.js";

// Health
export { waitForDeploymentHealth, checkServiceHealth, checkContainersRunning } from "./health.js";
export type { DeploymentHealthResult } from "./health.js";
