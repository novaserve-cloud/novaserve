/**
 * Resource Lifecycle Contract & Capability Matrix
 *
 * Defines the standard lifecycle execution contract (create, update, replace, delete, observe)
 * and the machine-readable resource capability matrix for cloud infrastructure resources.
 */

export interface ResourceExecutor<TConfig = Record<string, unknown>, TState = Record<string, unknown>> {
  create(config: TConfig, appName: string, environment?: string): Promise<TState>;
  update(previous: TConfig, next: TConfig, state: TState, appName?: string): Promise<TState>;
  replace(previous: TConfig, next: TConfig, state: TState, appName?: string): Promise<TState>;
  delete(state: TState, appName?: string): Promise<void>;
  observe(name: string, appName?: string): Promise<TState | null>;
}

export interface ResourceCapability {
  create: boolean;
  update: boolean;
  replace: boolean;
  delete: boolean;
  observe: boolean;
  immutableAttributes: string[];
}

export const RESOURCE_CAPABILITY_MATRIX: Record<string, ResourceCapability> = {
  function: {
    create: true,
    update: true,
    replace: true,
    delete: true,
    observe: true,
    immutableAttributes: ["architecture"],
  },
  api: {
    create: true,
    update: true,
    replace: true,
    delete: true,
    observe: true,
    immutableAttributes: ["protocolType"],
  },
  storage: {
    create: true,
    update: true,
    replace: true,
    delete: true,
    observe: true,
    immutableAttributes: ["bucketName"],
  },
  queue: {
    create: true,
    update: true,
    replace: true,
    delete: true,
    observe: true,
    immutableAttributes: ["fifoQueue"],
  },
  database: {
    create: true,
    update: true,
    replace: true,
    delete: true,
    observe: true,
    immutableAttributes: ["partitionKey", "sortKey", "engine"],
  },
  cache: {
    create: true,
    update: true,
    replace: true,
    delete: true,
    observe: true,
    immutableAttributes: ["engine"],
  },
};
