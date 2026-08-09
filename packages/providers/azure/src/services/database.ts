/**
 * Azure Cosmos DB Service — Real Cosmos DB Account & Container Operations
 *
 * Manages Cosmos DB Accounts, SQL Databases, and Containers using official @azure/arm-cosmosdb SDK.
 * Supports partition keys, throughput configuration, and continuous backup specifications.
 */

import { CosmosDBManagementClient } from "@azure/arm-cosmosdb";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";

export class AzureCosmosDBService {
  private client: CosmosDBManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.client = new CosmosDBManagementClient(credential, subscriptionId);
  }

  /** Create Cosmos DB Account, SQL Database, and Container */
  async createCosmosContainer(
    tableName: string,
    resourceGroup: string,
    location: string,
    appName: string,
    config: { partitionKey?: string; throughput?: number } = {},
    envName = "production"
  ): Promise<string> {
    const accountName = `${appName.toLowerCase().replace(/[^a-z0-9]/g, "")}-cosmos`;
    const databaseName = appName;
    const partitionKey = config.partitionKey || "id";

    // 1. Create Cosmos DB Account
    await azureRetry(() =>
      this.client.databaseAccounts.beginCreateOrUpdateAndWait(resourceGroup, accountName, {
        location,
        kind: "GlobalDocumentDB",
        databaseAccountOfferType: "Standard",
        locations: [{ locationName: location, failoverPriority: 0 }],
        backupPolicy: { type: "Continuous" },
        tags: {
          "novaserve-managed": "true",
          "novaserve-application": appName,
          "novaserve-environment": envName,
          "novaserve-resource": tableName,
          "novaserve-version": "2.0.0",
        },
      })
    );

    // 2. Create SQL Database
    await azureRetry(() =>
      this.client.sqlResources.beginCreateUpdateSqlDatabaseAndWait(resourceGroup, accountName, databaseName, {
        resource: { id: databaseName },
        options: { autoscaleSettings: { maxThroughput: 1000 } },
      })
    );

    // 3. Create SQL Container
    const container = await azureRetry(() =>
      this.client.sqlResources.beginCreateUpdateSqlContainerAndWait(resourceGroup, accountName, databaseName, tableName, {
        resource: {
          id: tableName,
          partitionKey: { paths: [`/${partitionKey}`], kind: "Hash" },
        },
      })
    );

    return container.id!;
  }

  /** Check if Cosmos DB Account exists */
  async getCosmosAccount(accountName: string, resourceGroup: string): Promise<{ id: string; state: string } | null> {
    try {
      const res = await azureRetry(() =>
        this.client.databaseAccounts.get(resourceGroup, accountName)
      );
      return { id: res.id!, state: res.provisioningState || "Unknown" };
    } catch {
      return null;
    }
  }

  /** Delete Cosmos DB Container or Account */
  async deleteCosmosContainer(tableName: string, accountName: string, resourceGroup: string): Promise<void> {
    const databaseName = accountName.replace(/-cosmos$/, "");
    try {
      await azureRetry(() =>
        this.client.sqlResources.beginDeleteSqlContainerAndWait(resourceGroup, accountName, databaseName, tableName)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }
}
