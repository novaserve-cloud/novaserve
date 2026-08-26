/**
 * GCP Live State Inspector
 *
 * Inspects actual deployed live infrastructure resources across GCP.
 * Supports all 8 NovaServe resource types:
 * - Cloud Functions (function)
 * - Cloud Storage (storage)
 * - Cloud SQL (database)
 * - Pub/Sub (queue)
 * - Cloud Scheduler (cron)
 * - Memorystore (cache)
 * - Secret Manager (secret)
 * - API Gateway (api)
 */

import { GCPFunctionsService } from "./services/functions.js";
import { GCPStorageService } from "./services/storage.js";
import { GCPDatabaseService } from "./services/database.js";
import { GCPPubSubService } from "./services/pubsub.js";
import { GCPSchedulerService } from "./services/scheduler.js";
import { GCPMemorystoreService } from "./services/memorystore.js";
import { GCPSecretManagerService } from "./services/secretmanager.js";
import { GCPApiGatewayService } from "./services/apigateway.js";

export interface ObservedGCPResource {
  resourceId: string;
  type: string;
  name: string;
  status: "deployed" | "missing" | "drifted";
  liveConfig: Record<string, unknown>;
  lastObservedIso: string;
}

export class GCPLiveStateInspector {
  private functions: GCPFunctionsService;
  private storage: GCPStorageService;
  private database: GCPDatabaseService;
  private pubsub: GCPPubSubService;
  private scheduler: GCPSchedulerService;
  private memorystore: GCPMemorystoreService;
  private secrets: GCPSecretManagerService;
  private apigateway: GCPApiGatewayService;
  private appName: string;

  constructor(projectId: string, region: string, authClient: unknown, appName: string = "unknown") {
    this.appName = appName;
    this.functions = new GCPFunctionsService(projectId, region);
    this.storage = new GCPStorageService(projectId, region);
    this.database = new GCPDatabaseService(projectId, region, authClient);
    this.pubsub = new GCPPubSubService(projectId);
    this.scheduler = new GCPSchedulerService(projectId, region);
    this.memorystore = new GCPMemorystoreService(projectId, region);
    this.secrets = new GCPSecretManagerService(projectId);
    this.apigateway = new GCPApiGatewayService(projectId, region);
  }

  /** Inspect live GCP state for Nova IR resources */
  public async inspectResources(
    resources: Array<{ id: string; type: string; name: string; config: Record<string, unknown> }>
  ): Promise<Record<string, ObservedGCPResource>> {
    const observed: Record<string, ObservedGCPResource> = {};

    const results = await Promise.allSettled(
      resources.map((res) => this.inspectSingle(res))
    );

    for (let i = 0; i < results.length; i++) {
      const res = resources[i]!;
      const result = results[i]!;

      if (result.status === "fulfilled") {
        observed[res.id] = result.value;
      } else {
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

  private async inspectSingle(
    res: { id: string; type: string; name: string; config: Record<string, unknown> }
  ): Promise<ObservedGCPResource> {
    const physicalName = `${this.appName}-${res.name}`;
    const liveConfig: Record<string, unknown> = {};
    let isMissing = false;

    switch (res.type) {
      case "function": {
        const state = await this.functions.getFunction(physicalName);
        if (!state) {
          isMissing = true;
        } else {
          liveConfig.state = state.state;
          liveConfig.runtime = state.runtime;
          liveConfig.environmentVariables = state.environmentVariables;
        }
        break;
      }
      case "storage": {
        const exists = await this.storage.bucketExists(physicalName);
        if (!exists) {
          isMissing = true;
        } else {
          liveConfig.exists = true;
        }
        break;
      }
      case "database": {
        const exists = await this.database.databaseExists(physicalName);
        if (!exists) {
          isMissing = true;
        } else {
          liveConfig.exists = true;
        }
        break;
      }
      case "queue": {
        const exists = await this.pubsub.topicExists(physicalName);
        if (!exists) {
          isMissing = true;
        } else {
          liveConfig.exists = true;
        }
        break;
      }
      case "cron": {
        const exists = await this.scheduler.jobExists(physicalName);
        if (!exists) {
          isMissing = true;
        } else {
          liveConfig.exists = true;
        }
        break;
      }
      case "cache": {
        const exists = await this.memorystore.instanceExists(physicalName);
        if (!exists) {
          isMissing = true;
        } else {
          liveConfig.exists = true;
        }
        break;
      }
      case "secret": {
        const exists = await this.secrets.secretExists(physicalName);
        if (!exists) {
          isMissing = true;
        } else {
          // Never expose secret values — only confirm existence
          liveConfig.exists = true;
        }
        break;
      }
      case "api": {
        const exists = await this.apigateway.apiExists(physicalName);
        if (!exists) {
          isMissing = true;
        } else {
          liveConfig.exists = true;
        }
        break;
      }
      default: {
        isMissing = false;
        break;
      }
    }

    return {
      resourceId: res.id,
      type: res.type,
      name: res.name,
      status: isMissing ? "missing" : "deployed",
      liveConfig,
      lastObservedIso: new Date().toISOString(),
    };
  }
}
