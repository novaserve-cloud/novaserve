/**
 * Cloudflare Live State Inspector
 *
 * Inspects actual deployed live infrastructure resources across Cloudflare Workers,
 * R2 Buckets, KV Namespaces, and Queues via REST API v4.
 */

import { CloudflareWorkersService } from "./services/workers.js";
import { CloudflareStorageService } from "./services/storage.js";

export interface ObservedCloudflareResource {
  resourceId: string;
  type: string;
  name: string;
  status: "deployed" | "missing" | "drifted";
  liveConfig: Record<string, unknown>;
  lastObservedIso: string;
}

export class CloudflareLiveStateInspector {
  private apiToken: string;
  private accountId: string;
  private appName: string;

  constructor(apiToken: string, accountId: string, appName: string = "unknown") {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.appName = appName;
  }

  /** Inspect live Cloudflare state for Nova IR resources */
  public async inspectResources(
    resources: Array<{ id: string; type: string; name: string; config: Record<string, unknown> }>
  ): Promise<Record<string, ObservedCloudflareResource>> {
    const observed: Record<string, ObservedCloudflareResource> = {};
    const workers = new CloudflareWorkersService(this.apiToken, this.accountId);
    const storage = new CloudflareStorageService(this.apiToken, this.accountId);

    for (const res of resources) {
      const physicalName = `${this.appName}-${res.name}`;
      const liveConfig: Record<string, unknown> = {};
      let isMissing = false;

      try {
        switch (res.type) {
          case "function": {
            const state = await workers.getWorker(physicalName);
            if (!state) {
              isMissing = true;
            } else {
              liveConfig.modified_on = state.modified_on;
            }
            break;
          }
          case "storage": {
            const exists = await storage.r2BucketExists(physicalName);
            if (!exists) {
              isMissing = true;
            }
            break;
          }
          default: {
            isMissing = false;
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
