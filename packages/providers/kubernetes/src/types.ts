import type { Resource } from "novaserve-core";

export type KubernetesScalar = string | number | boolean | null;

export type KubernetesManifest = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export interface KubernetesSecretRef {
  name: string;
  key?: string;
  optional?: boolean;
}

export interface KubernetesResourceBundle {
  resource: Resource;
  providerId: string;
  objects: KubernetesManifest[];
  outputs: Record<string, string>;
}

export interface KubernetesApplyResult {
  action: "created" | "configured" | "unchanged" | "deleted" | "skipped";
  object: string;
}

export interface KubernetesClusterStatus {
  configured: boolean;
  context?: string;
  cluster?: string;
  namespace: string;
  serverVersion?: string;
  warnings: string[];
}

export interface KubernetesAccessReview {
  valid: boolean;
  errors: Array<{ resource: string; message: string }>;
  warnings: Array<{ resource: string; message: string }>;
}

export interface KubernetesClient {
  getStatus(namespace: string): Promise<KubernetesClusterStatus>;
  validateAccess(namespace: string): Promise<KubernetesAccessReview>;
  applyObject(object: KubernetesManifest): Promise<KubernetesApplyResult>;
  deleteObject(object: KubernetesManifest): Promise<KubernetesApplyResult>;
  waitForDeployment(namespace: string, name: string, timeoutSeconds: number): Promise<void>;
  getLogs(
    namespace: string,
    selector: Record<string, string>,
    options?: { limit?: number; since?: Date; follow?: boolean }
  ): AsyncIterable<{ timestamp: Date; pod: string; message: string }>;
}

export interface KubernetesProviderOptions {
  client?: KubernetesClient;
  now?: () => Date;
}

export interface KubernetesProviderConfig {
  context?: string;
  namespace?: string;
  apply?: boolean;
  dryRun?: boolean;
  expectedContext?: string;
  expectedCluster?: string;
  fieldManager?: string;
  defaultImage?: string;
  imagePullSecrets?: string[];
  ingressClassName?: string;
  tlsSecretName?: string;
  waitForRollout?: boolean;
  rolloutTimeoutSeconds?: number;
  serviceAccountName?: string;
  networkPolicy?: boolean;
}
