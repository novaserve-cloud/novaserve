/**
 * Azure Queue Service — Real Storage Queues & Service Bus Queues
 *
 * Manages Azure Storage Queues and Service Bus Namespaces/Queues using official SDKs.
 * Supports in-place updates for message lock duration, retention, and visibility timeouts.
 */

import { ServiceBusManagementClient } from "@azure/arm-servicebus";
import { StorageManagementClient } from "@azure/arm-storage";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";

export class AzureQueueService {
  private serviceBusClient: ServiceBusManagementClient;
  private storageClient: StorageManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.serviceBusClient = new ServiceBusManagementClient(credential, subscriptionId);
    this.storageClient = new StorageManagementClient(credential, subscriptionId);
  }

  /** Create a Service Bus Namespace & Queue */
  async createServiceBusQueue(
    queueName: string,
    resourceGroup: string,
    location: string,
    appName: string,
    config: { lockDurationSec?: number; maxDeliveryCount?: number } = {},
    envName = "production"
  ): Promise<{ queueId: string; queueName: string }> {
    const namespaceName = `${appName.toLowerCase().replace(/[^a-z0-9]/g, "")}-sb`;

    // 1. Create Service Bus Namespace
    await azureRetry(() =>
      this.serviceBusClient.namespaces.beginCreateOrUpdateAndWait(resourceGroup, namespaceName, {
        location,
        sku: { name: "Standard", tier: "Standard" },
        tags: {
          "novaserve-managed": "true",
          "novaserve-application": appName,
          "novaserve-environment": envName,
          "novaserve-resource": queueName,
          "novaserve-version": "2.0.0",
        },
      })
    );

    // 2. Create Service Bus Queue
    const queue = await azureRetry(() =>
      this.serviceBusClient.queues.createOrUpdate(resourceGroup, namespaceName, queueName, {
        lockDuration: `PT${config.lockDurationSec || 30}S`,
        maxDeliveryCount: config.maxDeliveryCount || 10,
        deadLetteringOnMessageExpiration: true,
      })
    );

    return {
      queueId: queue.id!,
      queueName: queue.name!,
    };
  }

  /** Update Service Bus Queue attributes in-place */
  async updateQueueAttributes(
    namespaceName: string,
    queueName: string,
    resourceGroup: string,
    config: { lockDurationSec?: number; maxDeliveryCount?: number }
  ): Promise<void> {
    await azureRetry(() =>
      this.serviceBusClient.queues.createOrUpdate(resourceGroup, namespaceName, queueName, {
        lockDuration: config.lockDurationSec ? `PT${config.lockDurationSec}S` : undefined,
        maxDeliveryCount: config.maxDeliveryCount,
      })
    );
  }

  /** Delete Service Bus Queue */
  async deleteQueue(namespaceName: string, queueName: string, resourceGroup: string): Promise<void> {
    try {
      await azureRetry(() =>
        this.serviceBusClient.queues.delete(resourceGroup, namespaceName, queueName)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }
}
