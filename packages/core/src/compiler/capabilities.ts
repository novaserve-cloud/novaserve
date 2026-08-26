/**
 * Capability-Based Provider System
 *
 * Defines capability contracts for cloud providers and validates
 * whether a target provider supports the capabilities requested by Nova IR.
 */

export type CapabilityName =
  | "compute"
  | "storage"
  | "queue"
  | "database"
  | "cache"
  | "events"
  | "secrets"
  | "websocket"
  | "cron";

export interface CapabilityFeature {
  name: CapabilityName;
  supportedEngines?: string[];
  maxMemoryMb?: number;
  maxTimeoutSec?: number;
  notes?: string;
}

export interface ProviderCapabilityMatrix {
  providerName: string;
  displayName: string;
  supportedCapabilities: Record<CapabilityName, boolean | CapabilityFeature>;
  alternatives: Record<string, string[]>;
}

export interface CapabilityCheckResult {
  valid: boolean;
  errors: Array<{
    resourceId: string;
    capability: CapabilityName;
    requestedEngine?: string;
    message: string;
    alternatives?: string[];
  }>;
}

/** Provider Capability Matrices */
export const KNOWN_PROVIDER_CAPABILITIES: Record<string, ProviderCapabilityMatrix> = {
  aws: {
    providerName: "aws",
    displayName: "Amazon Web Services (AWS)",
    supportedCapabilities: {
      compute: true,
      storage: true,
      queue: true,
      database: { name: "database", supportedEngines: ["postgres", "mysql", "dynamodb"] },
      cache: { name: "cache", supportedEngines: ["redis", "memcached"] },
      events: true,
      secrets: true,
      websocket: true,
      cron: true,
    },
    alternatives: {},
  },
  azure: {
    providerName: "azure",
    displayName: "Microsoft Azure",
    supportedCapabilities: {
      compute: true,
      storage: true,
      queue: true,
      database: { name: "database", supportedEngines: ["cosmosdb", "postgres", "mysql"] },
      cache: { name: "cache", supportedEngines: ["redis"] },
      events: true,
      secrets: true,
      websocket: true,
      cron: true,
    },
    alternatives: {},
  },
  gcp: {
    providerName: "gcp",
    displayName: "Google Cloud Platform",
    supportedCapabilities: {
      compute: true,
      storage: true,
      queue: true,
      database: { name: "database", supportedEngines: ["postgres", "mysql"] },
      cache: { name: "cache", supportedEngines: ["redis"] },
      events: true,
      secrets: true,
      websocket: false,
      cron: true,
    },
    alternatives: {
      websocket: ["Cloud Run WebSocket support", "Firebase Realtime Database"],
      dynamodb: ["Firestore", "Cloud Bigtable"],
      mongodb: ["Firestore", "MongoDB Atlas on GCP"],
    },
  },
  cloudflare: {
    providerName: "cloudflare",
    displayName: "Cloudflare Workers & R2",
    supportedCapabilities: {
      compute: true,
      storage: { name: "storage", supportedEngines: ["r2", "kv"] },
      queue: true,
      database: false, // Cloudflare D1 exists, but native Postgres engine requires external driver
      cache: true,
      events: true,
      secrets: true,
      websocket: true,
      cron: true,
    },
    alternatives: {
      postgres: ["Neon PostgreSQL", "Supabase Database", "External Managed PostgreSQL"],
      mysql: ["PlanetScale MySQL", "External Managed MySQL"],
    },
  },
  docker: {
    providerName: "docker",
    displayName: "Docker / Local Containers",
    supportedCapabilities: {
      compute: true,
      storage: true,
      queue: true,
      database: { name: "database", supportedEngines: ["postgres", "mysql", "mongodb", "redis"] },
      cache: true,
      events: true,
      secrets: true,
      websocket: true,
      cron: true,
    },
    alternatives: {},
  },
  kubernetes: {
    providerName: "kubernetes",
    displayName: "Kubernetes",
    supportedCapabilities: {
      compute: true,
      storage: true,
      queue: { name: "queue", notes: "Kubernetes runs queue workers; a broker such as NATS, RabbitMQ, Redis, or a managed queue must be provided." },
      database: { name: "database", supportedEngines: ["postgres", "mysql", "mongodb"], notes: "Production databases should use an operator or external managed service for backup and HA." },
      cache: { name: "cache", supportedEngines: ["redis"] },
      events: false,
      secrets: true,
      websocket: false,
      cron: true,
    },
    alternatives: {
      events: ["KEDA", "Knative Eventing", "CloudEvents broker"],
      websocket: ["Ingress/controller websocket support", "Cloud provider websocket service"],
    },
  },
  k8s: {
    providerName: "k8s",
    displayName: "Kubernetes",
    supportedCapabilities: {
      compute: true,
      storage: true,
      queue: { name: "queue", notes: "Kubernetes runs queue workers; a broker such as NATS, RabbitMQ, Redis, or a managed queue must be provided." },
      database: { name: "database", supportedEngines: ["postgres", "mysql", "mongodb"], notes: "Production databases should use an operator or external managed service for backup and HA." },
      cache: { name: "cache", supportedEngines: ["redis"] },
      events: false,
      secrets: true,
      websocket: false,
      cron: true,
    },
    alternatives: {
      events: ["KEDA", "Knative Eventing", "CloudEvents broker"],
      websocket: ["Ingress/controller websocket support", "Cloud provider websocket service"],
    },
  },
  local: {
    providerName: "local",
    displayName: "NovaServe Local Development Engine",
    supportedCapabilities: {
      compute: true,
      storage: true,
      queue: true,
      database: true,
      cache: true,
      events: true,
      secrets: true,
      websocket: true,
      cron: true,
    },
    alternatives: {},
  },
};

/** Validate requested IR capabilities against target provider matrix */
export function validateCapabilities(
  requestedCapabilities: Array<{ resourceId: string; capability: CapabilityName; engine?: string }>,
  providerName: string
): CapabilityCheckResult {
  const matrix = KNOWN_PROVIDER_CAPABILITIES[providerName.toLowerCase()];
  const errors: CapabilityCheckResult["errors"] = [];

  if (!matrix) {
    // If unknown provider, default to warning/pass but log message
    return { valid: true, errors: [] };
  }

  for (const req of requestedCapabilities) {
    const supp = matrix.supportedCapabilities[req.capability];
    if (!supp) {
      const altKey = req.engine || req.capability;
      const proposed = matrix.alternatives[altKey] || [];
      const altText = proposed.length > 0 ? `\nAvailable alternatives:\n` + proposed.map((a, i) => `  ${i + 1}. ${a}`).join("\n") : "";

      errors.push({
        resourceId: req.resourceId,
        capability: req.capability,
        requestedEngine: req.engine,
        message: `Capability "${req.capability}" ${req.engine ? `(${req.engine})` : ""} is not supported natively by provider "${matrix.displayName}".${altText}`,
        alternatives: proposed,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
