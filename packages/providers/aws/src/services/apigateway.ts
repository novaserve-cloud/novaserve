/**
 * AWS API Gateway v2 (HTTP API) Service — Real Operations
 *
 * Creates HTTP APIs, routes, and Lambda integrations using AWS SDK v3.
 * Supports incremental route diffing (additions/removals) without HTTP API recreation,
 * full ownership tagging, and exponential backoff retry handling.
 */

import {
  ApiGatewayV2Client,
  CreateApiCommand,
  DeleteApiCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  DeleteRouteCommand,
  CreateStageCommand,
  GetApisCommand,
  GetRoutesCommand,
  type Api,
} from "@aws-sdk/client-apigatewayv2";
import { LambdaClient, AddPermissionCommand } from "@aws-sdk/client-lambda";
import { awsRetry } from "../utils/retry.js";

export interface ApiGatewayResult {
  apiId: string;
  apiEndpoint: string;
}

export class ApiGatewayService {
  private client: ApiGatewayV2Client;
  private lambdaClient: LambdaClient;
  private region: string;
  private accountId: string;

  constructor(region: string, accountId: string) {
    this.region = region;
    this.accountId = accountId;
    this.client = new ApiGatewayV2Client({ region });
    this.lambdaClient = new LambdaClient({ region });
  }

  /**
   * Create an HTTP API with routes pointing to Lambda functions.
   */
  async createHttpApi(
    apiName: string,
    routes: Record<string, string>,
    functionArns: Record<string, string>,
    appName: string,
    environment = "production"
  ): Promise<ApiGatewayResult> {
    const createResult = await awsRetry(() =>
      this.client.send(
        new CreateApiCommand({
          Name: apiName,
          ProtocolType: "HTTP",
          Description: `NovaServe HTTP API for ${appName}`,
          CorsConfiguration: {
            AllowOrigins: ["*"],
            AllowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            AllowHeaders: ["*"],
          },
          Tags: {
            "novaserve:managed": "true",
            "novaserve:application": appName,
            "novaserve:environment": environment,
            "novaserve:resource": apiName,
            "novaserve:version": "1.0.0",
          },
        })
      )
    );

    const apiId = createResult.ApiId!;
    const apiEndpoint = createResult.ApiEndpoint!;

    // Attach routes and integrations
    await this.syncRoutes(apiId, routes, functionArns, appName);

    // Create default stage with auto-deploy
    await awsRetry(() =>
      this.client.send(
        new CreateStageCommand({
          ApiId: apiId,
          StageName: "$default",
          AutoDeploy: true,
        })
      )
    );

    return { apiId, apiEndpoint };
  }

  /**
   * Update an existing HTTP API in-place by diffing routes (adding new, deleting removed)
   */
  async updateHttpApi(
    apiId: string,
    routes: Record<string, string>,
    functionArns: Record<string, string>,
    appName: string
  ): Promise<void> {
    // Get existing routes
    const getRoutesRes = await awsRetry(() =>
      this.client.send(new GetRoutesCommand({ ApiId: apiId }))
    );
    const existingItems = getRoutesRes.Items || [];
    const existingRouteKeys = new Map<string, string>(); // routeKey -> routeId

    for (const r of existingItems) {
      if (r.RouteKey && r.RouteId) {
        existingRouteKeys.set(r.RouteKey, r.RouteId);
      }
    }

    const desiredKeys = new Set(Object.keys(routes));

    // Delete removed routes
    for (const [routeKey, routeId] of existingRouteKeys.entries()) {
      if (!desiredKeys.has(routeKey)) {
        await awsRetry(() =>
          this.client.send(new DeleteRouteCommand({ ApiId: apiId, RouteId: routeId }))
        );
      }
    }

    // Add new or update routes
    await this.syncRoutes(apiId, routes, functionArns, appName, existingRouteKeys);
  }

  /** Delete an HTTP API */
  async deleteHttpApi(apiId: string): Promise<void> {
    try {
      await awsRetry(() => this.client.send(new DeleteApiCommand({ ApiId: apiId })));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotFoundException") {
        return; // Already deleted
      }
      throw err;
    }
  }

  /** Find an existing API by name */
  async findApi(apiName: string): Promise<Api | null> {
    const result = await awsRetry(() => this.client.send(new GetApisCommand({})));
    return result.Items?.find((api) => api.Name === apiName) || null;
  }

  // ── Private ──────────────────────────────────────────

  private async syncRoutes(
    apiId: string,
    routes: Record<string, string>,
    functionArns: Record<string, string>,
    appName: string,
    existingRouteKeys?: Map<string, string>
  ): Promise<void> {
    for (const [routeKey, handlerRef] of Object.entries(routes)) {
      if (existingRouteKeys && existingRouteKeys.has(routeKey)) {
        continue; // Route already exists
      }

      const functionArn = functionArns[handlerRef];
      if (!functionArn) continue;

      const functionName = functionArn.split(":").pop()!;

      const integration = await awsRetry(() =>
        this.client.send(
          new CreateIntegrationCommand({
            ApiId: apiId,
            IntegrationType: "AWS_PROXY",
            IntegrationUri: functionArn,
            PayloadFormatVersion: "2.0",
          })
        )
      );

      await awsRetry(() =>
        this.client.send(
          new CreateRouteCommand({
            ApiId: apiId,
            RouteKey: routeKey,
            Target: `integrations/${integration.IntegrationId}`,
          })
        )
      );

      try {
        await awsRetry(() =>
          this.lambdaClient.send(
            new AddPermissionCommand({
              FunctionName: functionName,
              StatementId: `apigateway-${apiId}-${routeKey.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}`,
              Action: "lambda:InvokeFunction",
              Principal: "apigateway.amazonaws.com",
              SourceArn: `arn:aws:execute-api:${this.region}:${this.accountId}:${apiId}/*/*`,
            })
          )
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "ResourceConflictException") {
          throw err;
        }
      }
    }
  }
}
