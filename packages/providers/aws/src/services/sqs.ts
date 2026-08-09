/**
 * AWS SQS Service — Real SQS Queue Operations
 */

import {
  SQSClient,
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueUrlCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { awsRetry } from "../utils/retry.js";

export class SQSService {
  private client: SQSClient;
  private region: string;

  constructor(region: string) {
    this.region = region;
    this.client = new SQSClient({ region });
  }

  /** Create an SQS queue */
  async createQueue(
    queueName: string,
    config: { visibilityTimeout?: number; messageRetentionPeriod?: number } = {},
    appName: string = "",
    environment = "production"
  ): Promise<{ queueUrl: string; queueArn: string }> {
    const result = await awsRetry(() =>
      this.client.send(
        new CreateQueueCommand({
          QueueName: queueName,
          Attributes: {
            VisibilityTimeout: String(config.visibilityTimeout || 30),
            MessageRetentionPeriod: String(config.messageRetentionPeriod || 345600), // 4 days
          },
          tags: {
            "novaserve:managed": "true",
            "novaserve:application": appName,
            "novaserve:environment": environment,
            "novaserve:resource": queueName,
            "novaserve:version": "1.0.0",
          },
        })
      )
    );

    const queueUrl = result.QueueUrl!;

    const attrs = await awsRetry(() =>
      this.client.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ["QueueArn"],
        })
      )
    );

    return {
      queueUrl,
      queueArn: attrs.Attributes?.QueueArn || `arn:aws:sqs:${this.region}:*:${queueName}`,
    };
  }

  /** Update SQS queue attributes in-place without queue recreation */
  async updateQueueAttributes(
    queueName: string,
    config: { visibilityTimeout?: number; messageRetentionPeriod?: number }
  ): Promise<void> {
    const queueUrl = await this.getQueueUrl(queueName);
    if (!queueUrl) return;

    const attributes: Record<string, string> = {};
    if (config.visibilityTimeout !== undefined) {
      attributes.VisibilityTimeout = String(config.visibilityTimeout);
    }
    if (config.messageRetentionPeriod !== undefined) {
      attributes.MessageRetentionPeriod = String(config.messageRetentionPeriod);
    }

    if (Object.keys(attributes).length > 0) {
      await awsRetry(() =>
        this.client.send(
          new SetQueueAttributesCommand({
            QueueUrl: queueUrl,
            Attributes: attributes,
          })
        )
      );
    }
  }

  /** Get the URL for a queue by name */
  async getQueueUrl(queueName: string): Promise<string | null> {
    try {
      const result = await awsRetry(() =>
        this.client.send(new GetQueueUrlCommand({ QueueName: queueName }))
      );
      return result.QueueUrl || null;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === "QueueDoesNotExist" || err.name === "AWS.SimpleQueueService.NonExistentQueue")
      ) {
        return null;
      }
      throw err;
    }
  }

  /** Delete an SQS queue */
  async deleteQueue(queueName: string): Promise<void> {
    const queueUrl = await this.getQueueUrl(queueName);
    if (!queueUrl) return;

    await awsRetry(() => this.client.send(new DeleteQueueCommand({ QueueUrl: queueUrl })));
  }
}
