/**
 * AWS DynamoDB Service — Real DynamoDB Table Operations
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
  type KeySchemaElement,
  type AttributeDefinition,
} from "@aws-sdk/client-dynamodb";

export class DynamoDBService {
  private client: DynamoDBClient;
  private region: string;

  constructor(region: string) {
    this.region = region;
    this.client = new DynamoDBClient({ region });
  }

  /** Create a DynamoDB table */
  async createTable(
    tableName: string,
    config: {
      partitionKey?: string;
      sortKey?: string;
      billingMode?: "PAY_PER_REQUEST" | "PROVISIONED";
    } = {},
    appName: string = ""
  ): Promise<string> {
    const partitionKey = config.partitionKey || "id";

    const keySchema: KeySchemaElement[] = [
      { AttributeName: partitionKey, KeyType: "HASH" },
    ];

    const attributeDefinitions: AttributeDefinition[] = [
      { AttributeName: partitionKey, AttributeType: "S" },
    ];

    if (config.sortKey) {
      keySchema.push({ AttributeName: config.sortKey, KeyType: "RANGE" });
      attributeDefinitions.push({ AttributeName: config.sortKey, AttributeType: "S" });
    }

    const result = await this.client.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: keySchema,
        AttributeDefinitions: attributeDefinitions,
        BillingMode: config.billingMode || "PAY_PER_REQUEST",
        Tags: [
          { Key: "novaserve:app", Value: appName },
          { Key: "novaserve:managed", Value: "true" },
        ],
      })
    );

    // Wait for table to become active
    await waitUntilTableExists(
      { client: this.client, maxWaitTime: 120 },
      { TableName: tableName }
    );

    return result.TableDescription?.TableArn || `arn:aws:dynamodb:${this.region}:*:table/${tableName}`;
  }

  /** Check if a table exists and return its ARN */
  async describeTable(tableName: string): Promise<{ tableArn: string; status: string } | null> {
    try {
      const result = await this.client.send(
        new DescribeTableCommand({ TableName: tableName })
      );
      return {
        tableArn: result.Table?.TableArn || "",
        status: result.Table?.TableStatus || "UNKNOWN",
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        return null;
      }
      throw err;
    }
  }

  /** Delete a DynamoDB table */
  async deleteTable(tableName: string): Promise<void> {
    try {
      await this.client.send(new DeleteTableCommand({ TableName: tableName }));
      await waitUntilTableNotExists(
        { client: this.client, maxWaitTime: 120 },
        { TableName: tableName }
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        return; // Already deleted
      }
      throw err;
    }
  }
}
