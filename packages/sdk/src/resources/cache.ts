/**
 * Cache Resource Builder
 *
 * Define managed cache instances (Redis, Memcached).
 */

import type { ResourceDefinition } from "../app.js";

/** Cache configuration */
export interface CacheConfig {
  /** Instance size */
  size?: "small" | "medium" | "large";
  /** Maximum memory in MB */
  maxMemory?: number;
  /** Eviction policy */
  evictionPolicy?: "lru" | "lfu" | "random" | "ttl";
  /** Default TTL in seconds */
  defaultTTL?: number;
  /** Enable persistence */
  persistence?: boolean;
  /** Enable cluster mode */
  cluster?: boolean;
  /** Number of replicas */
  replicas?: number;
}

/** Resolved cache resource */
export interface CacheResource extends ResourceDefinition {
  readonly _type: "cache";
  readonly _config: CacheConfig & { engine: string } & Record<string, unknown>;
}

/**
 * Cache resource builder.
 *
 * @example
 * ```ts
 * // Simple Redis cache
 * cache.redis()
 *
 * // Configured cache
 * cache.redis({
 *   size: "medium",
 *   evictionPolicy: "lru",
 *   defaultTTL: 3600,
 * })
 * ```
 */
export const cache = {
  redis(config: CacheConfig = {}): CacheResource {
    return {
      _type: "cache",
      _name: "cache",
      _config: {
        engine: "redis",
        size: "small",
        evictionPolicy: "lru",
        defaultTTL: 3600,
        persistence: false,
        cluster: false,
        replicas: 0,
        ...config,
      } as CacheConfig & { engine: string } & Record<string, unknown>,
    };
  },

  memcached(config: CacheConfig = {}): CacheResource {
    return {
      _type: "cache",
      _name: "cache",
      _config: {
        engine: "memcached",
        size: "small",
        evictionPolicy: "lru",
        defaultTTL: 3600,
        ...config,
      } as CacheConfig & { engine: string } & Record<string, unknown>,
    };
  },
};
