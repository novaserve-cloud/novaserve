/**
 * Azure Cache for Redis Service — Real Azure Redis Operations
 *
 * Manages Azure Cache for Redis instances using the official @azure/arm-redis SDK.
 * Supports Basic, Standard, and Premium tiers with configurable capacity,
 * TLS enforcement, and connection string retrieval.
 */

import { RedisManagementClient, type RedisResource } from "@azure/arm-rediscache";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";
import { buildNovaServeTags } from "../types.js";

export interface AzureCacheState {
  cacheId: string;
  cacheName: string;
  hostname: string;
  port: number;
  sslPort: number;
  provisioningState: string;
  primaryKey?: string;
  connectionString?: string;
}

export class AzureCacheService {
  private client: RedisManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.client = new RedisManagementClient(credential, subscriptionId);
  }

  /**
   * Create or update an Azure Cache for Redis instance.
   */
  async createCache(
    cacheName: string,
    resourceGroup: string,
    location: string,
    appName: string,
    config: {
      sku?: "Basic" | "Standard" | "Premium";
      family?: "C" | "P";
      capacity?: number;
      enableNonSslPort?: boolean;
      minimumTlsVersion?: string;
      redisConfiguration?: Record<string, string>;
    } = {},
    envName = "production"
  ): Promise<AzureCacheState> {
    const cleanName = this.resolveCacheName(cacheName, appName);
    const sku = config.sku || "Standard";
    const family = config.family || (sku === "Premium" ? "P" : "C");
    const capacity = config.capacity ?? (sku === "Basic" ? 0 : 1);

    const result = await azureRetry(() =>
      this.client.redis.beginCreateAndWait(resourceGroup, cleanName, {
        location,
        sku: {
          name: sku,
          family,
          capacity,
        },
        enableNonSslPort: config.enableNonSslPort ?? false,
        minimumTlsVersion: config.minimumTlsVersion || "1.2",
        redisConfiguration: config.redisConfiguration || {},
        tags: buildNovaServeTags(appName, envName, cacheName),
      })
    );

    // Retrieve access keys
    let primaryKey: string | undefined;
    let connectionString: string | undefined;
    try {
      const keys = await azureRetry(() =>
        this.client.redis.listKeys(resourceGroup, cleanName)
      );
      primaryKey = keys.primaryKey;
      connectionString = `${cleanName}.redis.cache.windows.net:6380,password=${primaryKey},ssl=True,abortConnect=False`;
    } catch {
      // Keys may not be immediately available
    }

    return {
      cacheId: result.id!,
      cacheName: cleanName,
      hostname: result.hostName || `${cleanName}.redis.cache.windows.net`,
      port: result.port || 6379,
      sslPort: result.sslPort || 6380,
      provisioningState: result.provisioningState || "Succeeded",
      primaryKey,
      connectionString,
    };
  }

  /**
   * Update an existing Redis cache configuration.
   */
  async updateCache(
    cacheName: string,
    resourceGroup: string,
    appName: string,
    config: {
      enableNonSslPort?: boolean;
      minimumTlsVersion?: string;
      redisConfiguration?: Record<string, string>;
    }
  ): Promise<void> {
    const cleanName = this.resolveCacheName(cacheName, appName);

    await azureRetry(() =>
      this.client.redis.beginUpdateAndWait(resourceGroup, cleanName, {
        enableNonSslPort: config.enableNonSslPort,
        minimumTlsVersion: config.minimumTlsVersion,
        redisConfiguration: config.redisConfiguration,
      })
    );
  }

  /**
   * Get cache instance details.
   */
  async getCache(
    cacheName: string,
    resourceGroup: string,
    appName: string
  ): Promise<AzureCacheState | null> {
    const cleanName = this.resolveCacheName(cacheName, appName);

    try {
      const result = await azureRetry(() =>
        this.client.redis.get(resourceGroup, cleanName)
      );
      return {
        cacheId: result.id!,
        cacheName: cleanName,
        hostname: result.hostName || `${cleanName}.redis.cache.windows.net`,
        port: result.port || 6379,
        sslPort: result.sslPort || 6380,
        provisioningState: result.provisioningState || "Unknown",
      };
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return null;
      throw err;
    }
  }

  /**
   * Delete an Azure Cache for Redis instance.
   */
  async deleteCache(
    cacheName: string,
    resourceGroup: string,
    appName: string
  ): Promise<void> {
    const cleanName = this.resolveCacheName(cacheName, appName);

    try {
      await azureRetry(() =>
        this.client.redis.beginDeleteAndWait(resourceGroup, cleanName)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────

  private resolveCacheName(cacheName: string, appName: string): string {
    // Azure Redis names: 1-63 chars, alphanumeric + hyphens, no consecutive hyphens
    return `${appName}-${cacheName}`.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-").slice(0, 63);
  }
}
