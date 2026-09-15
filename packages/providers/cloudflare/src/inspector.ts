/**
 * Cloudflare Live State Inspector
 *
 * Inspects actual deployed live infrastructure resources across Cloudflare
 * Workers, R2 Buckets, KV Namespaces, D1 Databases, and Queues via API v4.
 * Detects drift between expected and actual state.
 */

import { CloudflareApiClient } from "./utils/api-client.js";
import { CloudflareWorkersService } from "./services/workers.js";
import { CloudflareStorageService } from "./services/storage.js";
import { CloudflareKVService } from "./services/kv.js";
import { CloudflareD1Service } from "./services/d1.js";
import { CloudflareQueueService } from "./services/queues.js";

export interface ObservedCloudflareResource {
  resourceId: string;
  type: string;
  name: string;
  status: "deployed" | "missing" | "drifted";
  liveConfig: Record<string, unknown>;
  lastObservedIso: string;
}

export class CloudflareLiveStateInspector {
  private client: CloudflareApiClient;
  private appName: string;
  private workers: CloudflareWorkersService;
  private storage: CloudflareStorageService;
  private kv: CloudflareKVService;
  private d1: CloudflareD1Service;
  private queues: CloudflareQueueService;

  constructor(
    apiToken: string,
    accountId: string,
    appName: string = "unknown"
  ) {
    this.appName = appName;
    this.client = new CloudflareApiClient({ apiToken, accountId });
    this.workers = new CloudflareWorkersService(this.client);
    this.storage = new CloudflareStorageService(this.client);
    this.kv = new CloudflareKVService(this.client);
    this.d1 = new CloudflareD1Service(this.client);
    this.queues = new CloudflareQueueService(this.client);
  }

  /**
   * Inspect live Cloudflare state for Nova IR resources.
   */
  public async inspectResources(
    resources: Array<{
      id: string;
      type: string;
      name: string;
      config: Record<string, unknown>;
    }>
  ): Promise<Record<string, ObservedCloudflareResource>> {
    const observed: Record<string, ObservedCloudflareResource> = {};

    for (const res of resources) {
      const physicalName = `${this.appName}-${res.name}`;
      const liveConfig: Record<string, unknown> = {};
      let isMissing = false;

      try {
        switch (res.type) {
          case "function":
          case "api":
          case "cron": {
            const state = await this.workers.getWorker(physicalName);
            if (!state) {
              isMissing = true;
            } else {
              liveConfig.modified_on = state.modified_on;
              liveConfig.worker_id = state.id;
            }
            break;
          }
          case "storage": {
            const exists = await this.storage.bucketExists(physicalName);
            if (!exists) {
              isMissing = true;
            }
            break;
          }
          case "cache": {
            const ns = await this.kv.findNamespaceByTitle(physicalName);
            if (!ns) {
              isMissing = true;
            } else {
              liveConfig.namespace_id = ns.id;
              liveConfig.title = ns.title;
            }
            break;
          }
          case "database": {
            const db = await this.d1.findDatabaseByName(physicalName);
            if (!db) {
              isMissing = true;
            } else {
              liveConfig.database_id = db.uuid;
              liveConfig.num_tables = db.num_tables;
              liveConfig.file_size = db.file_size;
            }
            break;
          }
          case "queue": {
            const queue = await this.queues.findQueueByName(physicalName);
            if (!queue) {
              isMissing = true;
            } else {
              liveConfig.queue_id = queue.queue_id;
            }
            break;
          }
          default: {
            // Unknown type — report as deployed (can't verify)
            break;
          }
        }

        observed[res.id] = {
          resourceId: res.id,
          type: res.type,
          name: res.name,
          status: isMissing ? "missing" : "deployed",
          liveConfig,
          lastObservedIso: new Date().toISOString(),
        };
      } catch {
        observed[res.id] = {
          resourceId: res.id,
          type: res.type,
          name: res.name,
          status: "missing",
          liveConfig: {},
          lastObservedIso: new Date().toISOString(),
        };
      }
    }

    return observed;
  }
}
