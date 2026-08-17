/**
 * Azure Event Grid Service — Real Event Grid Operations
 *
 * Manages Azure Event Grid Topics and Event Subscriptions using official
 * @azure/arm-eventgrid SDK. Supports webhook destinations, Azure Function
 * endpoints, event type filtering, and dead-letter configuration.
 */

import { EventGridManagementClient } from "@azure/arm-eventgrid";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";
import { buildNovaServeTags } from "../types.js";

export interface EventGridTopicState {
  topicId: string;
  topicName: string;
  endpoint: string;
  provisioningState: string;
}

export interface EventGridSubscriptionState {
  subscriptionId: string;
  subscriptionName: string;
  provisioningState: string;
}

export class AzureEventGridService {
  private client: EventGridManagementClient;
  private subscriptionId: string;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.subscriptionId = subscriptionId;
    this.client = new EventGridManagementClient(credential, subscriptionId);
  }

  /**
   * Create or update an Event Grid Topic.
   */
  async createTopic(
    topicName: string,
    resourceGroup: string,
    location: string,
    appName: string,
    envName = "production"
  ): Promise<EventGridTopicState> {
    const cleanName = this.resolveTopicName(topicName, appName);

    const result = await azureRetry(() =>
      this.client.topics.beginCreateOrUpdateAndWait(resourceGroup, cleanName, {
        location,
        inputSchema: "EventGridSchema",
        publicNetworkAccess: "Enabled",
        tags: buildNovaServeTags(appName, envName, topicName),
      })
    );

    return {
      topicId: result.id!,
      topicName: cleanName,
      endpoint: result.endpoint || "",
      provisioningState: result.provisioningState || "Succeeded",
    };
  }

  /**
   * Create an Event Subscription on a topic with a webhook or Azure Function endpoint.
   */
  async createSubscription(
    topicName: string,
    subscriptionName: string,
    resourceGroup: string,
    appName: string,
    config: {
      endpointUrl: string;
      eventTypes?: string[];
      deadLetterBlobContainer?: string;
      deadLetterStorageAccount?: string;
    }
  ): Promise<EventGridSubscriptionState> {
    const cleanTopicName = this.resolveTopicName(topicName, appName);
    const topicScope = `/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventGrid/topics/${cleanTopicName}`;

    const subscriptionParams: Record<string, unknown> = {
      destination: {
        endpointType: "WebHook",
        properties: {
          endpointUrl: config.endpointUrl,
          maxEventsPerBatch: 1,
          preferredBatchSizeInKilobytes: 64,
        },
      },
      filter: {
        isSubjectCaseSensitive: false,
        includedEventTypes: config.eventTypes || [],
      },
      retryPolicy: {
        maxDeliveryAttempts: 30,
        eventTimeToLiveInMinutes: 1440, // 24 hours
      },
    };

    // Configure dead-letter destination if specified
    if (config.deadLetterBlobContainer && config.deadLetterStorageAccount) {
      (subscriptionParams as any).deadLetterDestination = {
        endpointType: "StorageBlob",
        properties: {
          resourceId: `/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${config.deadLetterStorageAccount}`,
          blobContainerName: config.deadLetterBlobContainer,
        },
      };
    }

    const result = await azureRetry(() =>
      this.client.eventSubscriptions.beginCreateOrUpdateAndWait(
        topicScope,
        subscriptionName,
        subscriptionParams as any
      )
    );

    return {
      subscriptionId: result.id!,
      subscriptionName: result.name!,
      provisioningState: result.provisioningState || "Succeeded",
    };
  }

  /**
   * Get Event Grid Topic details.
   */
  async getTopic(
    topicName: string,
    resourceGroup: string,
    appName: string
  ): Promise<EventGridTopicState | null> {
    const cleanName = this.resolveTopicName(topicName, appName);

    try {
      const result = await azureRetry(() =>
        this.client.topics.get(resourceGroup, cleanName)
      );
      return {
        topicId: result.id!,
        topicName: cleanName,
        endpoint: result.endpoint || "",
        provisioningState: result.provisioningState || "Unknown",
      };
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return null;
      throw err;
    }
  }

  /**
   * Delete an Event Grid Topic (cascade deletes subscriptions).
   */
  async deleteTopic(
    topicName: string,
    resourceGroup: string,
    appName: string
  ): Promise<void> {
    const cleanName = this.resolveTopicName(topicName, appName);

    try {
      await azureRetry(() =>
        this.client.topics.beginDeleteAndWait(resourceGroup, cleanName)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }

  /**
   * Delete a specific Event Subscription.
   */
  async deleteSubscription(
    topicName: string,
    subscriptionName: string,
    resourceGroup: string,
    appName: string
  ): Promise<void> {
    const cleanTopicName = this.resolveTopicName(topicName, appName);
    const topicScope = `/subscriptions/${this.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.EventGrid/topics/${cleanTopicName}`;

    try {
      await azureRetry(() =>
        this.client.eventSubscriptions.beginDeleteAndWait(topicScope, subscriptionName)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────

  private resolveTopicName(topicName: string, appName: string): string {
    // Event Grid topic names: 3-50 chars, alphanumeric + hyphens
    return `${appName}-${topicName}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50);
  }
}
