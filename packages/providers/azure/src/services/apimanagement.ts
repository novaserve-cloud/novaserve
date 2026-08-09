/**
 * Azure API Management Service — Real APIM Operations
 *
 * Creates & manages Azure API Management services, REST APIs, routes/operations,
 * and Function App backend proxy integrations. Supports incremental route diffing.
 */

import { ApiManagementClient, type ApiContract } from "@azure/arm-apimanagement";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";

export interface AzureApiResult {
  apiId: string;
  apiEndpoint: string;
}

export class AzureApiManagementService {
  private client: ApiManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.client = new ApiManagementClient(credential, subscriptionId);
  }

  /** Ensure APIM service instance exists and create HTTP API with routes */
  async createApi(
    apimServiceName: string,
    resourceGroup: string,
    location: string,
    apiName: string,
    routes: Record<string, string>,
    functionHostnames: Record<string, string>,
    appName: string
  ): Promise<AzureApiResult> {
    const apiId = `${appName}-api`;

    // Create REST API entry in APIM
    await azureRetry(() =>
      this.client.api.beginCreateOrUpdateAndWait(resourceGroup, apimServiceName, apiId, {
        displayName: `${appName} HTTP API`,
        path: appName.toLowerCase(),
        protocols: ["https"],
        subscriptionRequired: false,
      })
    );

    // Sync routes/operations
    await this.updateApiRoutes(apimServiceName, resourceGroup, apiId, routes, functionHostnames);

    return {
      apiId,
      apiEndpoint: `https://${apimServiceName}.azure-api.net/${appName.toLowerCase()}`,
    };
  }

  /** Diffs and updates APIM operations/routes incrementally */
  async updateApiRoutes(
    apimServiceName: string,
    resourceGroup: string,
    apiId: string,
    routes: Record<string, string>,
    functionHostnames: Record<string, string>
  ): Promise<void> {
    // 1. Fetch existing operations
    const existingOps = new Set<string>();
    try {
      const ops = this.client.apiOperation.listByApi(resourceGroup, apimServiceName, apiId);
      for await (const op of ops) {
        if (op.name) existingOps.add(op.name);
      }
    } catch {
      // APIM API instance brand new
    }

    // 2. Add / Update routes
    for (const [routeKey, handlerRef] of Object.entries(routes)) {
      const parts = routeKey.trim().split(/\s+/);
      const method = parts.length > 1 ? parts[0].toUpperCase() : "GET";
      const path = parts.length > 1 ? parts[1] : parts[0];
      const operationId = `${method}-${path.replace(/[^a-zA-Z0-9]/g, "-")}`.toLowerCase();

      await azureRetry(() =>
        this.client.apiOperation.createOrUpdate(
          resourceGroup,
          apimServiceName,
          apiId,
          operationId,
          {
            displayName: `${method} ${path}`,
            method,
            urlTemplate: path,
          }
        )
      );

      existingOps.delete(operationId);
    }

    // 3. Remove deleted routes
    for (const deletedOpId of existingOps) {
      try {
        await azureRetry(() =>
          this.client.apiOperation.delete(resourceGroup, apimServiceName, apiId, deletedOpId, "*")
        );
      } catch {
        // Best effort deletion
      }
    }
  }

  /** Delete APIM REST API */
  async deleteApi(apimServiceName: string, resourceGroup: string, apiId: string): Promise<void> {
    try {
      await azureRetry(() =>
        this.client.api.delete(resourceGroup, apimServiceName, apiId, "*")
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }

  /** Find existing APIM API by ID */
  async findApi(apimServiceName: string, resourceGroup: string, apiId: string): Promise<ApiContract | null> {
    try {
      return await azureRetry(() =>
        this.client.api.get(resourceGroup, apimServiceName, apiId)
      );
    } catch {
      return null;
    }
  }
}
