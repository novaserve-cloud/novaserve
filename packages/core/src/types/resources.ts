/**
 * Core Resource Types
 *
 * Canonical resource definitions used by providers and the deployment engine.
 */

/** All supported resource types */
export type ResourceType =
  | "function"
  | "api"
  | "storage"
  | "database"
  | "queue"
  | "cron"
  | "cache"
  | "secret"
  | "cdn"
  | "websocket"
  | "email"
  | "search"
  | "auth";

/** Base resource definition */
export interface Resource {
  /** Unique resource type */
  type: ResourceType;
  /** Resource name (unique within the app) */
  name: string;
  /** Full configuration */
  config: Record<string, unknown>;
  /** Resources this depends on */
  dependencies: string[];
}

/** Resource after resolution by the core engine */
export interface ResolvedResource extends Resource {
  /** Unique ID: "{app}-{type}-{name}" */
  id: string;
  /** Config hash for change detection */
  configHash: string;
  /** Provider-specific mapped resource (ARN, URL, etc.) */
  providerConfig?: Record<string, unknown>;
  /** Outputs after deployment */
  outputs?: Record<string, string>;
  /** Cloud provider name ("aws" | "azure" | "local" | etc.) */
  provider?: string;
  /** Physical cloud resource ID / ARN / URI */
  providerId?: string;
  /** Cloud account ID or subscription ID */
  account?: string;
  /** Cloud region or location */
  region?: string;
  /** Current status */
  status: ResourceStatus;
}

/** Resource lifecycle status */
export type ResourceStatus =
  | "pending"
  | "creating"
  | "updating"
  | "deployed"
  | "failed"
  | "deleting"
  | "deleted";

/**
 * Convert SDK ResourceDefinition to core Resource format.
 */
export function toResource(sdkResource: {
  _type: string;
  _name: string;
  _config: Record<string, unknown>;
  _dependencies?: Array<{ _type: string; _name: string }>;
}): Resource {
  return {
    type: sdkResource._type as ResourceType,
    name: sdkResource._name,
    config: sdkResource._config,
    dependencies: (sdkResource._dependencies || []).map(
      (d) => `${d._type}-${d._name}`
    ),
  };
}
