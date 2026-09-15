/**
 * novaserve-provider-cloudflare — Production-Ready Cloudflare Provider
 *
 * Deploys to Cloudflare Workers, R2 Buckets, D1 Databases, KV Namespaces,
 * and Queues with secure provisioning, bindings, environment isolation,
 * migrations, deployment tracking, rollback, and CI/CD support.
 */

// ── Provider ──────────────────────────────────────────────────
export { CloudflareProvider } from "./provider.js";

// ── Types ─────────────────────────────────────────────────────
export type {
  CloudflareProviderConfig,
  CloudflareWorkerConfig,
  CloudflareKVConfig,
  CloudflareR2Config,
  CloudflareD1Config,
  CloudflareQueueConfig,
  CloudflareBindingDefinition,
  CloudflareBindingType,
  CloudflareResolvedBinding,
  CloudflareEnvironmentConfig,
  CloudflareBuildConfig,
  CloudflareDeploymentContext,
  CloudflareDeploymentMetadata,
  CloudflareProvisionedResources,
  CloudflareRouteConfig,
  CloudflareCustomDomainConfig,
  WorkerDomain,
  CloudflareApiResponse,
  CloudflareWorkerMetadata,
  CloudflareKVNamespace,
  CloudflareR2Bucket,
  CloudflareD1Database,
  CloudflareQueue,
  CloudflareMigration,
  CloudflareMigrationStatus,
} from "./types.js";

// ── Errors ────────────────────────────────────────────────────
export {
  CloudflareError,
  CloudflareAuthenticationError,
  CloudflarePermissionError,
  CloudflareResourceNotFoundError,
  CloudflareResourceExistsError,
  CloudflareDeploymentError,
  CloudflareMigrationError,
  CloudflareRateLimitError,
  CloudflareNetworkError,
  mapCloudflareApiError,
  sanitizeErrorMessage,
} from "./errors.js";

// ── Services ──────────────────────────────────────────────────
export { CloudflareWorkersService } from "./services/workers.js";
export { CloudflareStorageService } from "./services/storage.js";
export { CloudflareKVService } from "./services/kv.js";
export { CloudflareD1Service } from "./services/d1.js";
export { CloudflareQueueService } from "./services/queues.js";
export { CloudflareSecretsService } from "./services/secrets.js";
export { CloudflareLogsService } from "./services/logs.js";

// ── Utilities ─────────────────────────────────────────────────
export { CloudflareAuthManager } from "./utils/auth.js";
export { CloudflareApiClient } from "./utils/api-client.js";
export { cloudflareRetry } from "./utils/retry.js";
export { resolveBindings, bindingsToApiFormat, validateBindingNames } from "./utils/bindings.js";
export {
  resolveEnvironmentName,
  resolveWorkerName,
  isProductionEnvironment,
  mergeEnvironmentVars,
  mergeEnvironmentSecrets,
} from "./utils/environment.js";

// ── Validators ────────────────────────────────────────────────
export {
  validateCloudflareConfig,
  validateWorkerName,
  validateR2BucketName,
  validateBindingName,
  validateEnvVarName,
  sanitizeInput,
} from "./validators.js";

// ── Inspector ─────────────────────────────────────────────────
export { CloudflareLiveStateInspector } from "./inspector.js";
export type { ObservedCloudflareResource } from "./inspector.js";
