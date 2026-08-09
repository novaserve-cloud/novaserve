/**
 * Azure Storage Service — Real Storage Accounts & Blob Containers
 *
 * Manages Storage Accounts and Blob Containers using official @azure/arm-storage
 * and @azure/storage-blob SDKs. Enforces encryption, public access block, and retention policies.
 */

import { StorageManagementClient, type StorageAccount } from "@azure/arm-storage";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";

export class AzureStorageService {
  private client: StorageManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.client = new StorageManagementClient(credential, subscriptionId);
  }

  /** Create Storage Account & Blob Container */
  async createStorageAccount(
    accountName: string,
    containerName: string,
    resourceGroup: string,
    location: string,
    appName: string,
    envName = "production"
  ): Promise<string> {
    const cleanAccountName = accountName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);

    // 1. Create Storage Account with HTTPS & encryption
    await azureRetry(() =>
      this.client.storageAccounts.beginCreateAndWait(resourceGroup, cleanAccountName, {
        location,
        sku: { name: "Standard_LRS" },
        kind: "StorageV2",
        enableHttpsTrafficOnly: true,
        allowBlobPublicAccess: false,
        minimumTlsVersion: "TLS1_2",
        encryption: {
          services: { blob: { enabled: true } },
          keySource: "Microsoft.Storage",
        },
        tags: {
          "novaserve-managed": "true",
          "novaserve-application": appName,
          "novaserve-environment": envName,
          "novaserve-resource": accountName,
          "novaserve-version": "2.0.0",
        },
      })
    );

    // 2. Create Blob Container
    await azureRetry(() =>
      this.client.blobContainers.create(resourceGroup, cleanAccountName, containerName, {
        publicAccess: "None",
      })
    );

    return `/subscriptions/${this.client.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${cleanAccountName}/blobServices/default/containers/${containerName}`;
  }

  /** Check if Storage Account exists */
  async accountExists(accountName: string, resourceGroup: string): Promise<boolean> {
    const cleanAccountName = accountName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
    try {
      await azureRetry(() =>
        this.client.storageAccounts.getProperties(resourceGroup, cleanAccountName)
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Delete Storage Account (safeguarded by removalPolicy) */
  async deleteStorageAccount(
    accountName: string,
    resourceGroup: string,
    force = false,
    removalPolicy = "destroy"
  ): Promise<void> {
    if (removalPolicy === "retain" && !force) {
      console.warn(`[NovaServe Safety] Retaining Azure Storage Account "${accountName}" due to removalPolicy="retain".`);
      return;
    }

    const cleanAccountName = accountName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
    try {
      await azureRetry(() =>
        this.client.storageAccounts.delete(resourceGroup, cleanAccountName)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }
}
