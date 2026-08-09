/**
 * AWS SQS Service — Real SQS Queue Operations
 */

import {
  SQSClient,
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueUrlCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";

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
    appName: string = ""
  ): Promise<{ queueUrl: string; queueArn: string }> {
    const result = await this.client.send(
      new CreateQueueCommand({
        QueueName: queueName,
        Attributes: {
          VisibilityTimeout: String(config.visibilityTimeout || 30),
          MessageRetentionPeriod: String(config.messageRetentionPeriod || 345600), // 4 days
        },
        tags: {
          "novaserve:app": appName,
          "novaserve:managed": "true",
        },
      })
    );

    const queueUrl = result.QueueUrl!;

    // Get the queue ARN
    const attrs = await this.client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["QueueArn"],
      })
    );

    return {
      queueUrl,
      queueArn: attrs.Attributes?.QueueArn || `arn:aws:sqs:${this.region}:*:${queueName}`,
    };
  }

  /** Get the URL for a queue by name */
  async getQueueUrl(queueName: string): Promise<string | null> {
    try {
      const result = await this.client.send(
        new GetQueueUrlCommand({ QueueName: queueName })
      );
      return result.QueueUrl || null;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === "QueueDoesNotExist" ||
          err.name === "AWS.SimpleQueueService.NonExistentQueue")
      ) {
        return null;
      }
      throw err;
    }
  }

  /** Delete an SQS queue */
  async deleteQueue(queueName: string): Promise<void> {
    const queueUrl = await this.getQueueUrl(queueName);
    if (!queueUrl) return; // Already deleted

    await this.client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  }
}
