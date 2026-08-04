/**
 * Function Resource Builder
 *
 * Define standalone serverless functions.
 * For API-attached functions, use the api builder's route handlers.
 */

import type { ResourceDefinition } from "../app.js";

/** Function configuration */
export interface FunctionConfig {
  /** Path to the handler file and export: "src/worker.handler" */
  handler: string;
  /** Memory in MB (default: 256) */
  memory?: number;
  /** Timeout in seconds (default: 30) */
  timeout?: number;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Function description */
  description?: string;
  /** Layers/extensions to attach */
  layers?: string[];
  /** Reserved concurrency */
  concurrency?: number;
  /** VPC configuration */
  vpc?: {
    subnets: string[];
    securityGroups: string[];
  };
}

/** Resolved function resource */
export interface FunctionResource extends ResourceDefinition {
  readonly _type: "function";
  readonly _config: FunctionConfig & Record<string, unknown>;
}

/**
 * Standalone function builder.
 *
 * @example
 * ```ts
 * fn.create("process-image", {
 *   handler: "src/workers/image.process",
 *   memory: 1024,
 *   timeout: 60,
 * })
 * ```
 */
export const fn = {
  create(name: string, config: FunctionConfig): FunctionResource {
    if (!name) {
      throw new Error("[NovaServe] Function name is required");
    }

    if (!config.handler) {
      throw new Error(`[NovaServe] Function "${name}" requires a handler path`);
    }

    return {
      _type: "function",
      _name: name,
      _config: {
        memory: 256,
        timeout: 30,
        ...config,
      } as FunctionConfig & Record<string, unknown>,
    };
  },
};
