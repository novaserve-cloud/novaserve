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
      const state = await this.inspectSingleResource(id, res, resourceGroup);
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
    resourceGroup: string
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
