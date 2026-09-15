/**
 * Cloudflare Queues Service — Queue Management
 *
 * Manages Cloudflare Queues with full CRUD lifecycle.
 * Idempotent: checks for existing queues before creating.
 */

import type { CloudflareApiClient } from "../utils/api-client.js";
import type { CloudflareQueue } from "../types.js";

export class CloudflareQueueService {
  private client: CloudflareApiClient;

  constructor(client: CloudflareApiClient) {
    this.client = client;
  }

  /**
   * Create a Cloudflare Queue.
   *
   * Idempotent: checks if a queue with the same name already exists.
   * If it does, returns the existing queue ID.
   *
   * @returns Queue ID
   */
  public async createQueue(queueName: string): Promise<string> {
    // Check for existing queue with this name
    const existing = await this.findQueueByName(queueName);
    if (existing) {
      return existing.queue_id;
    }

    try {
      const result = await this.client.post<CloudflareQueue>(
        "/queues",
        "createQueue",
        { queue_name: queueName },
        { resource: queueName }
      );

      return result?.queue_id || queueName;
    } catch (err: unknown) {
      // Handle already-exists gracefully
      if (
        err instanceof Error &&
        (err.name === "CloudflareResourceExistsError" ||
          err.message.includes("already exists"))
      ) {
        const found = await this.findQueueByName(queueName);
        return found?.queue_id || queueName;
      }
      throw err;
    }
  }

  /**
   * Get a queue by ID or name.
   */
  public async getQueue(
    queueId: string
  ): Promise<CloudflareQueue | null> {
    try {
      return await this.client.get<CloudflareQueue>(
        `/queues/${queueId}`,
        "getQueue",
        { resource: queueId }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return null;
      }
      throw err;
    }
  }

  /**
   * List all queues in the account.
   */
  public async listQueues(): Promise<CloudflareQueue[]> {
    const result = await this.client.get<CloudflareQueue[]>(
      "/queues",
      "listQueues"
    );
    return result || [];
  }

  /**
   * Delete a queue.
   * Silently succeeds if the queue doesn't exist.
   */
  public async deleteQueue(queueId: string): Promise<void> {
    try {
      await this.client.delete(`/queues/${queueId}`, "deleteQueue", {
        resource: queueId,
      });
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return;
      }
      throw err;
    }
  }

  /**
   * Find an existing queue by name.
   * Used for idempotent creates.
   */
  public async findQueueByName(
    queueName: string
  ): Promise<CloudflareQueue | null> {
    const queues = await this.listQueues();
    return (
      queues.find((q) => q.queue_name === queueName) || null
    );
  }
}
