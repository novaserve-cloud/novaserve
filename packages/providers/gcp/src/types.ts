/**
 * GCP Provider — Centralized Type Definitions
 *
 * Shared interfaces and types used across all GCP service modules,
 * the provider engine, inspector, and deployment lifecycle.
 */

// ── Provider Options ──────────────────────────────────────────

export interface GCPProviderOptions {
  /** GCP Project ID (defaults to GOOGLE_CLOUD_PROJECT env) */
  projectId?: string;
  /** GCP region/location (defaults to GOOGLE_CLOUD_REGION env or "us-central1") */
  region?: string;
  /** Path to service account key file (defaults to GOOGLE_APPLICATION_CREDENTIALS env) */
  keyFilename?: string;
}

// ── Deployment Context ────────────────────────────────────────

export interface GCPDeploymentContext {
  /** Application name from nova.config.ts */
  appName: string;
  /** Target environment (production, staging, preview, etc.) */
  environment: string;
  /** Resolved GCP Project ID */
  projectId: string;
  /** GCP region/location */
  region: string;
  /** NovaServe-managed labels applied to all resources */
  labels: Record<string, string>;
}

/** Build a standard NovaServe label set for any GCP resource */
export function buildNovaServeLabels(
  appName: string,
  environment: string,
  resourceName: string
): Record<string, string> {
  return {
    "novaserve-managed": "true",
    "novaserve-application": sanitizeLabelValue(appName),
    "novaserve-environment": sanitizeLabelValue(environment),
    "novaserve-resource": sanitizeLabelValue(resourceName),
    "novaserve-version": "2.1.0",
  };
}

/**
 * Sanitize a value for use as a GCP label value.
 * GCP labels must: be lowercase, start with a letter, contain only
 * lowercase letters, digits, hyphens, and underscores, max 63 chars.
 */
export function sanitizeLabelValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^[^a-z]/, "a")
    .slice(0, 63);
}

// ── Resource State ────────────────────────────────────────────

export interface GCPResourceState {
  /** GCP resource name/path */
  resourceId: string;
  /** Logical name within NovaServe */
  name: string;
  /** Resource type (function, storage, queue, etc.) */
  type: string;
  /** GCP resource state */
  state: string;
  /** Additional outputs (URLs, connection strings, hostnames) */
  outputs: Record<string, string>;
}

// ── Service Config Interfaces ─────────────────────────────────

export interface GCPFunctionConfig {
  /** Function runtime (default: "nodejs20") */
  runtime?: string;
  /** Entry point function name (default: "handler") */
  entryPoint?: string;
  /** Memory allocation in MB (default: 256, range: 128-32768) */
  memory?: number;
  /** Timeout in seconds (default: 60, max: 540 for 1st gen, 3600 for 2nd gen) */
  timeout?: number;
  /** Minimum instances to keep warm (default: 0) */
  minInstances?: number;
  /** Maximum concurrent instances (default: 100) */
  maxInstances?: number;
  /** Environment variables */
  environment?: Record<string, string>;
  /** VPC connector for private networking */
  vpcConnector?: string;
  /** Service account email to run as */
  serviceAccount?: string;
  /** Ingress settings: ALLOW_ALL, ALLOW_INTERNAL_ONLY, ALLOW_INTERNAL_AND_GCLB */
  ingressSettings?: string;
}

export interface GCPStorageConfig {
  /** Storage class: STANDARD, NEARLINE, COLDLINE, ARCHIVE */
  storageClass?: string;
  /** Enable versioning */
  versioning?: boolean;
  /** Lifecycle rules for object expiration */
  lifecycleRules?: Array<{
    action: { type: string; storageClass?: string };
    condition: { age?: number; isLive?: boolean };
  }>;
  /** Uniform bucket-level access */
  uniformBucketLevelAccess?: boolean;
  /** CORS configuration */
  cors?: Array<{
    origin: string[];
    method: string[];
    responseHeader?: string[];
    maxAgeSeconds?: number;
  }>;
}

export interface GCPQueueConfig {
  /** Pub/Sub message retention duration (e.g. "604800s" for 7 days) */
  messageRetentionDuration?: string;
  /** Acknowledgement deadline in seconds (default: 10) */
  ackDeadlineSeconds?: number;
  /** Enable message ordering */
  enableMessageOrdering?: boolean;
  /** Dead letter topic name */
  deadLetterTopic?: string;
  /** Max delivery attempts before dead-lettering (default: 5) */
  maxDeliveryAttempts?: number;
  /** Retry policy minimum backoff (e.g. "10s") */
  retryMinBackoff?: string;
  /** Retry policy maximum backoff (e.g. "600s") */
  retryMaxBackoff?: string;
}

export interface GCPSchedulerConfig {
  /** Cron schedule expression (e.g. "0 * * * *") */
  schedule: string;
  /** IANA time zone (default: "UTC") */
  timeZone?: string;
  /** Retry count for failed executions (default: 0) */
  retryCount?: number;
  /** Maximum retry duration (e.g. "0s" to disable) */
  maxRetryDuration?: string;
  /** Minimum backoff for retries (e.g. "5s") */
  minBackoffDuration?: string;
  /** Maximum backoff for retries (e.g. "3600s") */
  maxBackoffDuration?: string;
  /** Maximum doublings for exponential backoff */
  maxDoublings?: number;
}

export interface GCPDatabaseConfig {
  /** Database engine: "postgres" | "mysql" (default: "postgres") */
  engine?: string;
  /** Cloud SQL machine tier (default: "db-f1-micro") */
  tier?: string;
  /** Storage size in GB (default: 10) */
  storageSizeGb?: number;
  /** Storage auto-resize (default: true) */
  storageAutoResize?: boolean;
  /** Enable high availability (default: false) */
  highAvailability?: boolean;
  /** Backup enabled (default: true) */
  backupEnabled?: boolean;
  /** Backup start time (HH:MM format, default: "02:00") */
  backupStartTime?: string;
  /** Enable SSL for connections */
  requireSsl?: boolean;
  /** Authorized networks for access */
  authorizedNetworks?: Array<{ name: string; value: string }>;
  /** Database flags */
  databaseFlags?: Record<string, string>;
}

export interface GCPCacheConfig {
  /** Memorystore tier: "BASIC" | "STANDARD_HA" (default: "BASIC") */
  tier?: string;
  /** Memory size in GB (default: 1) */
  memorySizeGb?: number;
  /** Redis version (default: "REDIS_7_0") */
  redisVersion?: string;
  /** Display name for the instance */
  displayName?: string;
  /** Redis configuration parameters */
  redisConfigs?: Record<string, string>;
  /** Authorized network for private access */
  authorizedNetwork?: string;
  /** Connect mode: DIRECT_PEERING | PRIVATE_SERVICE_ACCESS */
  connectMode?: string;
}

export interface GCPSecretConfig {
  /** Replication policy: "automatic" | "user-managed" (default: "automatic") */
  replication?: string;
  /** Locations for user-managed replication */
  replicationLocations?: string[];
  /** Secret labels */
  labels?: Record<string, string>;
  /** Rotation period (e.g. "7776000s" for 90 days) */
  rotationPeriod?: string;
  /** Expiration time as ISO 8601 timestamp */
  expireTime?: string;
}

export interface GCPApiGatewayConfig {
  /** API display name */
  displayName?: string;
  /** OpenAPI spec for the API config */
  openapiSpec?: string;
  /** Backend URL for default routing */
  backendUrl?: string;
  /** Managed service name */
  managedService?: string;
}

// ── Supported Resource Types ──────────────────────────────────

/** GCP resource types supported by NovaServe */
export const GCP_SUPPORTED_RESOURCE_TYPES = [
  "function",
  "api",
  "storage",
  "queue",
  "cron",
  "database",
  "cache",
  "secret",
] as const;

export type GCPResourceType = (typeof GCP_SUPPORTED_RESOURCE_TYPES)[number];

/** Map of NovaServe resource types to GCP service names */
export const GCP_SERVICE_NAMES: Record<GCPResourceType, string> = {
  function: "Cloud Functions",
  api: "API Gateway",
  storage: "Cloud Storage",
  queue: "Pub/Sub",
  cron: "Cloud Scheduler",
  database: "Cloud SQL",
  cache: "Memorystore",
  secret: "Secret Manager",
};

// ── IAM Role Mappings ─────────────────────────────────────────

/** Least-privilege IAM roles for resource access */
export const GCP_LEAST_PRIVILEGE_ROLES: Record<string, string[]> = {
  function: ["roles/cloudfunctions.developer"],
  storage: ["roles/storage.objectAdmin"],
  queue: ["roles/pubsub.editor"],
  cron: ["roles/cloudscheduler.admin"],
  database: ["roles/cloudsql.client"],
  cache: ["roles/redis.editor"],
  secret: ["roles/secretmanager.secretAccessor"],
  api: ["roles/apigateway.admin"],
};

/** Minimum required GCP APIs that must be enabled */
export const GCP_REQUIRED_APIS = [
  "cloudfunctions.googleapis.com",
  "storage.googleapis.com",
  "pubsub.googleapis.com",
  "cloudscheduler.googleapis.com",
  "sqladmin.googleapis.com",
  "redis.googleapis.com",
  "secretmanager.googleapis.com",
  "apigateway.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "iam.googleapis.com",
] as const;
