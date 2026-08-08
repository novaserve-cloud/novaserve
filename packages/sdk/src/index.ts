/**
 * novaserve-sdk
 *
 * TypeScript-first serverless configuration SDK.
 * No YAML. No boilerplate. Just code.
 *
 * @example
 * ```ts
 * import { defineApp, api, storage, queue } from "novaserve";
 *
 * export default defineApp({
 *   name: "my-app",
 *   region: "ap-south-1",
 *   runtime: "node20",
 *   resources: {
 *     api: api.create({ routes: { "GET /": "src/index.handler" } }),
 *     uploads: storage.bucket("uploads"),
 *   },
 * });
 * ```
 */

// Core
export { defineApp } from "./app.js";

// Resource builders
export { api } from "./resources/api.js";
export { fn, fn as function_ } from "./resources/function.js";
export { storage } from "./resources/storage.js";
export { database } from "./resources/database.js";
export { queue } from "./resources/queue.js";
export { cron } from "./resources/cron.js";
export { cache } from "./resources/cache.js";
export { secret } from "./resources/secret.js";

// Helpers
export { env } from "./helpers/env.js";
export { link } from "./helpers/link.js";

// Re-export types
export type {
  NovaApp,
  NovaAppConfig,
  Runtime,
  Region,
  EnvironmentConfig,
} from "./app.js";

export type { ApiConfig, ApiResource, RouteMap, CorsConfig } from "./resources/api.js";
export type { FunctionConfig, FunctionResource } from "./resources/function.js";
export type { StorageConfig, StorageBucketResource } from "./resources/storage.js";
export type { DatabaseConfig, DatabaseResource, DatabaseEngine } from "./resources/database.js";
export type { QueueConfig, QueueResource } from "./resources/queue.js";
export type { CronConfig, CronResource } from "./resources/cron.js";
export type { CacheConfig, CacheResource } from "./resources/cache.js";
export type { SecretConfig, SecretResource } from "./resources/secret.js";
