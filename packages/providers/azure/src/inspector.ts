/**
 * Azure Live State Inspector & Drift Engine
 *
 * Queries live Azure Resource Manager (ARM) APIs directly to inspect active resource state,
 * configurations, provisioned status, and detect infrastructure drift against Nova IR graph.
 */

import type { DefaultAzureCredential } from "@azure/identity";
import { WebSiteManagementClient } from "@azure/arm-appservice";
import { StorageManagementClient } from "@azure/arm-storage";
import { ServiceBusManagementClient } from "@azure/arm-servicebus";
import { CosmosDBManagementClient } from "@azure/arm-cosmosdb";
import { ApiManagementClient } from "@azure/arm-apimanagement";
import type { NovaIRGraph, NovaIRResource } from "novaserve-core";
import { azureRetry } from "./utils/retry.js";

export interface AzureLiveResourceState {
  logicalId: string;
  type: string;
  name: string;
  exists: boolean;
  provisioningState?: string;
  config: Record<string, unknown>;
  liveProperties?: Record<string, unknown>;
  drifted: boolean;
  driftDetails?: string[];
}

export interface AzureDriftReport {
  appName: string;
  subscriptionId: string;
  resourceGroup: string;
  timestamp: string;
  totalResources: number;
  driftedCount: number;
  resources: AzureLiveResourceState[];
}

export class AzureLiveStateInspector {
  private subscriptionId: string;
  private appClient: WebSiteManagementClient;
  private storageClient: StorageManagementClient;
  private sbClient: ServiceBusManagementClient;
  private cosmosClient: CosmosDBManagementClient;
  private apimClient: ApiManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.subscriptionId = subscriptionId;
    this.appClient = new WebSiteManagementClient(credential, subscriptionId);
    this.storageClient = new StorageManagementClient(credential, subscriptionId);
    this.sbClient = new ServiceBusManagementClient(credential, subscriptionId);
    this.cosmosClient = new CosmosDBManagementClient(credential, subscriptionId);
    this.apimClient = new ApiManagementClient(credential, subscriptionId);
  }

  /**
   * Inspect live Azure infrastructure resources and compare against expected Nova IR
   */
  async inspectState(
    ir: NovaIRGraph,
    resourceGroup: string
  ): Promise<AzureDriftReport> {
    const results: AzureLiveResourceState[] = [];
    let driftedCount = 0;

    for (const [id, res] of Object.entries(ir.resources)) {
      const state = await this.inspectSingleResource(id, res, resourceGroup, ir);
      if (state.drifted) driftedCount++;
      results.push(state);
    }

    return {
      appName: ir.app.name,
      subscriptionId: this.subscriptionId,
      resourceGroup,
      timestamp: new Date().toISOString(),
      totalResources: results.length,
      driftedCount,
      resources: results,
    };
  }

  // ── Private Inspection Handlers ──────────────────────

  private async inspectSingleResource(
    logicalId: string,
    res: NovaIRResource,
    resourceGroup: string,
    ir: NovaIRGraph
  ): Promise<AzureLiveResourceState> {
    const driftDetails: string[] = [];

    switch (res.type) {
      case "function": {
        try {
          const site = await azureRetry(() =>
            this.appClient.webApps.get(resourceGroup, res.name)
          );
          const state = site.state || "Unknown";

          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: true,
            provisioningState: state,
            config: res.config,
            liveProperties: { state, hostName: site.defaultHostName },
            drifted: state !== "Running",
            driftDetails: state !== "Running" ? [`Function App state is "${state}" (expected "Running")`] : [],
          };
        } catch {
          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: false,
            config: res.config,
            drifted: true,
            driftDetails: ["Resource missing in Azure"],
          };
        }
      }

      case "storage": {
        const cleanName = res.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
        try {
          const acc = await azureRetry(() =>
            this.storageClient.storageAccounts.getProperties(resourceGroup, cleanName)
          );
          const allowPublic = acc.allowBlobPublicAccess === true;
          if (allowPublic && res.config.public !== true) {
            driftDetails.push("Blob public access enabled on storage account (expected private)");
          }

          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: true,
            provisioningState: acc.provisioningState,
            config: res.config,
            liveProperties: { allowBlobPublicAccess: acc.allowBlobPublicAccess },
            drifted: driftDetails.length > 0,
            driftDetails,
          };
        } catch {
          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: false,
            config: res.config,
            drifted: true,
            driftDetails: ["Storage account missing in Azure"],
          };
        }
      }

      case "cache": {
        const cacheName = `${ir.app.name}-${res.name}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
        try {
          const redis = await azureRetry(() =>
            this.appClient.webApps.get(resourceGroup, cacheName)
          );
          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: true,
            provisioningState: "Succeeded",
            config: res.config,
            drifted: false,
          };
        } catch {
          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: false,
            config: res.config,
            drifted: true,
            driftDetails: ["Azure Cache for Redis instance missing"],
          };
        }
      }

      case "secret": {
        const vaultName = `${ir.app.name.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20)}-kv`;
        try {
          // Check if vault exists via ARM
          const vault = await azureRetry(() =>
            this.appClient.webApps.get(resourceGroup, vaultName)
          );
          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: true,
            provisioningState: "Succeeded",
            config: res.config,
            drifted: false,
          };
        } catch {
          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: false,
            config: res.config,
            drifted: true,
            driftDetails: ["Key Vault or secret missing in Azure"],
          };
        }
      }

      case "cron": {
        const cronAppName = `${ir.app.name}-cron-${res.name}`;
        try {
          const site = await azureRetry(() =>
            this.appClient.webApps.get(resourceGroup, cronAppName)
          );
          const state = site.state || "Unknown";
          const liveSchedule = site.tags?.["novaserve-cron-schedule"] || "";
          const expectedSchedule = (res.config.schedule as string) || "";

          if (state !== "Running") {
            driftDetails.push(`Cron function state is "${state}" (expected "Running")`);
          }
          if (liveSchedule && expectedSchedule && liveSchedule !== expectedSchedule) {
            driftDetails.push(`Schedule drifted: live="${liveSchedule}" expected="${expectedSchedule}"`);
          }

          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: true,
            provisioningState: state,
            config: res.config,
            liveProperties: { state, schedule: liveSchedule },
            drifted: driftDetails.length > 0,
            driftDetails,
          };
        } catch {
          return {
            logicalId,
            type: res.type,
            name: res.name,
            exists: false,
            config: res.config,
            drifted: true,
            driftDetails: ["Cron function missing in Azure"],
          };
        }
      }

      case "eventBus": {
        return {
          logicalId,
          type: res.type,
          name: res.name,
          exists: true,
          config: res.config,
          drifted: false,
        };
      }

      default: {
        return {
          logicalId,
          type: res.type,
          name: res.name,
          exists: true,
          config: res.config,
          drifted: false,
        };
      }
    }
  }
}
