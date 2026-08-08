/**
 * Nova IR (Intermediate Representation) Schema
 *
 * Provider-agnostic, deterministic, versioned, and diffable
 * infrastructure graph definition for NovaServe.
 */

export interface NovaIRAppHeader {
  name: string;
  version: string;
  environment: string;
  region?: string;
  hash: string;
  createdIso: string;
}

export type NovaIRResourceType =
  | "function"
  | "api"
  | "route"
  | "websocket"
  | "storage"
  | "queue"
  | "database"
  | "cache"
  | "eventBus"
  | "eventSubscription"
  | "cron"
  | "secret"
  | "custom";

export interface NovaIRResource {
  id: string; // e.g. "function-usersList"
  type: NovaIRResourceType;
  name: string;
  configHash: string;
  config: Record<string, unknown>;
  dependencies: string[]; // List of resource IDs
  requiredCapabilities: string[];
}

export interface NovaIRPermission {
  id: string;
  targetFunction: string;
  actions: string[];
  resources: string[];
  reason: string;
}

export interface NovaIROutput {
  name: string;
  description: string;
  valueFromResource: string;
  valueKey: string;
}

export interface NovaIRGraph {
  schemaVersion: "1.0.0";
  app: NovaIRAppHeader;
  resources: Record<string, NovaIRResource>;
  dependencies: Array<{
    from: string;
    to: string;
    type: "link" | "event" | "permission";
  }>;
  capabilitiesRequired: string[];
  permissions: NovaIRPermission[];
  outputs: Record<string, NovaIROutput>;
}
