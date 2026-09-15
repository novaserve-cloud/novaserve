/**
 * Cloudflare Provider — Centralized Type Definitions
 *
 * Shared interfaces and types used across the Cloudflare provider,
 * services, binding resolver, and deployment lifecycle.
 */

// ── Provider Configuration ────────────────────────────────────

export interface CloudflareProviderConfig {
  /** Cloudflare Account ID (resolved from config or CLOUDFLARE_ACCOUNT_ID) */
  accountId?: string;
  /** Cloudflare API Token (resolved from config or CLOUDFLARE_API_TOKEN) */
  apiToken?: string;
  /** Cloudflare Zone ID for route/custom domain support */
  zoneId?: string;
  /** Worker configuration */
  worker?: CloudflareWorkerConfig;
  /** KV Namespace resource definitions */
  kv?: CloudflareKVConfig[];
  /** R2 Bucket resource definitions */
  r2?: CloudflareR2Config[];
  /** D1 Database resource definitions */
  d1?: CloudflareD1Config[];
  /** Queue resource definitions */
  queues?: CloudflareQueueConfig[];
  /** Per-environment overrides */
  environments?: Record<string, CloudflareEnvironmentConfig>;
  /** Build configuration */
  build?: CloudflareBuildConfig;
  /** Deployment stage label (default: inferred from environment) */
  stage?: string;
}

// ── Worker Configuration ──────────────────────────────────────

export interface CloudflareWorkerConfig {
  /** Worker script name */
  name?: string;
  /** Entrypoint file path (e.g. "src/index.ts") */
  entrypoint?: string;
  /** Compatibility date (e.g. "2024-01-01") */
  compatibilityDate?: string;
  /** Compatibility flags (e.g. ["nodejs_compat"]) */
  compatibilityFlags?: string[];
  /** Worker routes (requires Zone ID) */
  routes?: CloudflareRouteConfig[];
  /** Custom domains */
  customDomains?: string[];
  /** Cron triggers */
  crons?: string[];
  /** Environment variables (non-secret) */
  vars?: Record<string, string>;
  /** Secret names (values read from process.env at deploy time) */
  secrets?: string[];
  /** Resource bindings */
  bindings?: CloudflareBindingDefinition[];
  /** Custom domains (requires Zone ID) */
  domains?: CloudflareCustomDomainConfig[];
}

// ── Route Configuration ───────────────────────────────────────

export interface CloudflareRouteConfig {
  /** Route pattern (e.g. "example.com/*") */
  pattern: string;
  /** Zone ID override for this specific route */
  zoneId?: string;
}

// ── Domain Abstraction ────────────────────────────────────────

/**
 * Unified Worker domain abstraction.
 *
 * Distinguishes between:
 * - "workers-dev": Default <worker>.<account>.workers.dev subdomain (no config needed)
 * - "custom-domain": Custom domain attached to the Worker
 * - "route": Zone-based route pattern
 */
export interface WorkerDomain {
  type: "workers-dev" | "custom-domain" | "route";
  /** Hostname for custom domains */
  hostname?: string;
  /** Zone ID (required for routes and custom domains) */
  zoneId?: string;
  /** Route pattern (for route type only) */
  pattern?: string;
}

export interface CloudflareCustomDomainConfig {
  /** Custom domain hostname (e.g. "api.example.com") */
  domain: string;
  /** Zone ID for this domain */
  zoneId?: string;
}

// ── Resource Configurations ───────────────────────────────────

export interface CloudflareKVConfig {
  /** Binding name exposed as env.NAME in Worker */
  name: string;
  /** KV namespace title (defaults to environment-prefixed name) */
  title?: string;
}

export interface CloudflareR2Config {
  /** Binding name exposed as env.NAME in Worker */
  name: string;
  /** Bucket name (defaults to environment-prefixed name) */
  bucketName?: string;
  /** Location hint for bucket creation */
  locationHint?: string;
}

export interface CloudflareD1Config {
  /** Binding name exposed as env.NAME in Worker */
  name: string;
  /** Database name (defaults to environment-prefixed name) */
  databaseName?: string;
  /** Path to migrations directory */
  migrationsDir?: string;
}

export interface CloudflareQueueConfig {
  /** Binding name exposed as env.NAME in Worker */
  name: string;
  /** Queue name (defaults to environment-prefixed name) */
  queueName?: string;
}

// ── Binding Definitions ───────────────────────────────────────

export type CloudflareBindingType =
  | "kv_namespace"
  | "r2_bucket"
  | "d1"
  | "queue"
  | "secret_text"
  | "plain_text"
  | "service"
  | "analytics_engine";

export interface CloudflareBindingDefinition {
  /** Binding type */
  type: CloudflareBindingType;
  /** Binding name (accessible as env.NAME in Worker) */
  name: string;
  /** Resource identifier (namespace ID, bucket name, database ID, etc.) */
  resource?: string;
  /** For plain_text bindings: the text value */
  text?: string;
}

/** Resolved binding ready for Cloudflare API submission */
export interface CloudflareResolvedBinding {
  type: CloudflareBindingType;
  name: string;
  namespace_id?: string;
  bucket_name?: string;
  id?: string;
  queue_name?: string;
  text?: string;
  service?: string;
  dataset?: string;
}

// ── Environment Configuration ─────────────────────────────────

export interface CloudflareEnvironmentConfig {
  /** Environment-specific Worker overrides */
  worker?: Partial<CloudflareWorkerConfig>;
  /** Environment-specific env vars (merged with base) */
  vars?: Record<string, string>;
  /** Environment-specific secret names */
  secrets?: string[];
  /** Environment-specific KV overrides */
  kv?: CloudflareKVConfig[];
  /** Environment-specific R2 overrides */
  r2?: CloudflareR2Config[];
  /** Environment-specific D1 overrides */
  d1?: CloudflareD1Config[];
}

// ── Build Configuration ───────────────────────────────────────

export interface CloudflareBuildConfig {
  /** Minify Worker bundle (default: true for production) */
  minify?: boolean;
  /** Source maps (default: false) */
  sourcemap?: boolean;
  /** Custom build command (bypasses built-in bundler) */
  command?: string;
  /** Output directory for custom builds */
  outputDir?: string;
}

// ── Deployment Context ────────────────────────────────────────

export interface CloudflareDeploymentContext {
  /** Application name from nova.config.ts */
  appName: string;
  /** Target environment */
  environment: string;
  /** Resolved Cloudflare provider config */
  cloudflareConfig: CloudflareProviderConfig;
  /** Resolved worker name */
  workerName: string;
  /** Output directory for generated artifacts */
  outputDir: string;
  /** Project root directory */
  projectRoot: string;
  /** NovaServe version */
  novaVersion: string;
}

// ── Deployment Metadata ───────────────────────────────────────

export interface CloudflareDeploymentMetadata {
  /** Deployment ID */
  deploymentId: string;
  /** Application name */
  appName: string;
  /** Target environment */
  environment: string;
  /** Provider name */
  provider: "cloudflare";
  /** Worker script name */
  workerName: string;
  /** Worker URL */
  workerUrl?: string;
  /** Deployment status */
  status: "success" | "failed" | "rolled_back";
  /** Provisioned resource IDs */
  resources: CloudflareProvisionedResources;
  /** Deployment start time ISO */
  startedAt: string;
  /** Deployment completion time ISO */
  completedAt: string;
  /** Duration in ms */
  durationMs: number;
  /** Git commit hash */
  gitCommit?: string;
  /** Git branch */
  gitBranch?: string;
  /** NovaServe version */
  novaVersion: string;
}

export interface CloudflareProvisionedResources {
  /** Provisioned KV namespaces: binding name → namespace ID */
  kv: Record<string, string>;
  /** Provisioned R2 buckets: binding name → bucket name */
  r2: Record<string, string>;
  /** Provisioned D1 databases: binding name → database ID */
  d1: Record<string, string>;
  /** Provisioned Queues: binding name → queue ID */
  queues: Record<string, string>;
}

// ── Cloudflare API Response Types ─────────────────────────────

export interface CloudflareApiResponse<T = unknown> {
  success: boolean;
  result: T;
  errors: CloudflareApiError[];
  messages: CloudflareApiMessage[];
  result_info?: CloudflareResultInfo;
}

export interface CloudflareApiError {
  code: number;
  message: string;
}

export interface CloudflareApiMessage {
  code: number;
  message: string;
}

export interface CloudflareResultInfo {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

// ── Service-Specific Types ────────────────────────────────────

export interface CloudflareWorkerMetadata {
  id: string;
  tag?: string;
  etag?: string;
  size?: number;
  modified_on?: string;
  created_on?: string;
}

export interface CloudflareKVNamespace {
  id: string;
  title: string;
  supports_url_encoding?: boolean;
}

export interface CloudflareR2Bucket {
  name: string;
  creation_date?: string;
  location?: string;
}

export interface CloudflareD1Database {
  uuid: string;
  name: string;
  version?: string;
  num_tables?: number;
  file_size?: number;
  created_at?: string;
}

export interface CloudflareQueue {
  queue_id: string;
  queue_name: string;
  created_on?: string;
  modified_on?: string;
}

export interface CloudflareWorkerDeployment {
  id: string;
  source: string;
  strategy: string;
  author_email?: string;
  created_on: string;
  versions: Array<{ version_id: string; percentage: number }>;
}

// ── Migration Types ───────────────────────────────────────────

export interface CloudflareMigration {
  /** Migration filename (e.g. "0001_create_users.sql") */
  filename: string;
  /** Migration SQL content */
  sql: string;
  /** Migration order index */
  index: number;
}

export interface CloudflareMigrationStatus {
  /** Applied migration filenames */
  applied: string[];
  /** Pending migration filenames */
  pending: string[];
  /** Total migration count */
  total: number;
}
