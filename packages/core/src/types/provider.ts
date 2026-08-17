/**
 * Provider Interface
 *
 * The contract that every cloud provider must implement.
 * This is the abstraction that enables cloud-agnostic deployments.
 */

import type { Resource, ResolvedResource } from "./resources.js";
import type { NovaAppConfig } from "novaserve-sdk";

/** Provider status */
export interface ProviderStatus {
  /** Provider name */
  name: string;
  /** Whether the provider is properly configured */
  configured: boolean;
  /** Current region */
  region?: string;
  /** Account/project identifier */
  account?: string;
  /** Any warnings */
  warnings?: string[];
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ resource: string; message: string }>;
  warnings: Array<{ resource: string; message: string }>;
}

/** Single action in a deployment plan */
export interface DeploymentPlanAction {
  /** Action type */
  action: "create" | "update" | "replace" | "delete" | "skip";
  /** Target resource */
  resource: Resource;
  /** Reason for the action */
  reason: string;
  /** Estimated time */
  estimatedSeconds?: number;
  /** Strategy for executing updates or replacements */
  updateStrategy?: import("./lifecycle.js").UpdateStrategy;
  /** Whether replacing this resource requires data migration */
  requiresDataMigration?: boolean;
  /** Warning message if replacing this stateful resource risks data loss */
  dataLossWarning?: string;
  /** Resources this action depends on */
  dependsOn: string[];
}

/** Full deployment plan */
export interface DeploymentPlan {
  version?: string;
  deploymentId?: string;
  appName: string;
  provider: string;
  environment: string;
  irHash?: string;
  planHash?: string;
  createdAt?: string;
  actions: DeploymentPlanAction[];
  summary: {
    create: number;
    update: number;
    replace: number;
    delete: number;
    skip: number;
  };
}

/** Deployment result */
export interface DeployResult {
  /** Whether the deployment succeeded */
  success: boolean;
  /** Deployed resources with outputs */
  resources: ResolvedResource[];
  /** Total deployment duration in ms */
  durationMs: number;
  /** Errors encountered */
  errors: Array<{ resource: string; error: string }>;
  /** Output URLs/endpoints */
  outputs: Record<string, string>;
}

/** Log entry */
export interface LogEntry {
  /** Timestamp */
  timestamp: Date;
  /** Log level */
  level: "debug" | "info" | "warn" | "error";
  /** Resource that generated the log */
  resource: string;
  /** Log message */
  message: string;
  /** Request ID for tracing */
  requestId?: string;
}

/** Log query options */
export interface LogOptions {
  /** Start time */
  since?: Date;
  /** End time */
  until?: Date;
  /** Follow mode (tail -f) */
  follow?: boolean;
  /** Filter pattern */
  filter?: string;
  /** Max entries to return */
  limit?: number;
}

/** Function invocation result */
export interface InvokeResult {
  /** HTTP status code */
  statusCode: number;
  /** Response body */
  body: unknown;
  /** Response headers */
  headers: Record<string, string>;
  /** Execution duration in ms */
  durationMs: number;
  /** Memory used in MB */
  memoryUsedMB?: number;
  /** Whether it was a cold start */
  coldStart?: boolean;
}

/**
 * The NovaProvider interface.
 *
 * Every cloud provider (AWS, Azure, GCP, Cloudflare, Docker, Local)
 * must implement this interface to be used with NovaServe.
 */
export interface NovaProvider {
  /** Provider identifier */
  readonly name: string;

  /** Display name */
  readonly displayName: string;

  // ── Lifecycle ──────────────────────────────────────────

  /** Initialize the provider with app config */
  init(config: NovaAppConfig): Promise<void>;

  /** Validate that resources can be deployed */
  validate(resources: Resource[]): Promise<ValidationResult>;

  // ── Deployment ─────────────────────────────────────────

  /** Execute a deployment plan */
  deploy(plan: DeploymentPlan): Promise<DeployResult>;

  /** Destroy all resources */
  destroy(resources: ResolvedResource[]): Promise<void>;

  // ── Operations ─────────────────────────────────────────

  /** Stream logs from a resource */
  getLogs(resource: string, options?: LogOptions): AsyncIterable<LogEntry>;

  /** Invoke a function directly */
  invoke(functionName: string, payload: unknown): Promise<InvokeResult>;

  /** Check provider status and connectivity */
  getStatus(): Promise<ProviderStatus>;
}
