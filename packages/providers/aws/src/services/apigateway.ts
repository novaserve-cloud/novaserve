/**
 * AWS API Gateway v2 (HTTP API) Service — Real Operations
 *
 * Creates HTTP APIs, routes, and Lambda integrations using AWS SDK v3.
 */

import {
  ApiGatewayV2Client,
  CreateApiCommand,
  DeleteApiCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
  GetApisCommand,
  GetRoutesCommand,
  type Api,
} from "@aws-sdk/client-apigatewayv2";
import {
  LambdaClient,
  AddPermissionCommand,
} from "@aws-sdk/client-lambda";

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
   * Each route gets a Lambda proxy integration.
   */
  async createHttpApi(
    apiName: string,
    routes: Record<string, string>,
    functionArns: Record<string, string>,
    appName: string
  ): Promise<ApiGatewayResult> {
    // Create the HTTP API
    const createResult = await this.client.send(
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
          "novaserve:app": appName,
          "novaserve:managed": "true",
        },
      })
    );

    const apiId = createResult.ApiId!;
    const apiEndpoint = createResult.ApiEndpoint!;

    // Create integrations and routes
    for (const [routeKey, handlerRef] of Object.entries(routes)) {
      // Find the Lambda ARN for this handler
      const functionArn = functionArns[handlerRef];
      if (!functionArn) continue;

      // Extract function name from ARN
      const functionName = functionArn.split(":").pop()!;

      // Create Lambda integration
      const integration = await this.client.send(
        new CreateIntegrationCommand({
          ApiId: apiId,
          IntegrationType: "AWS_PROXY",
          IntegrationUri: functionArn,
          PayloadFormatVersion: "2.0",
        })
      );

      // Create the route
      await this.client.send(
        new CreateRouteCommand({
          ApiId: apiId,
          RouteKey: routeKey,
          Target: `integrations/${integration.IntegrationId}`,
        })
      );

      // Grant API Gateway permission to invoke Lambda
      try {
        await this.lambdaClient.send(
          new AddPermissionCommand({
            FunctionName: functionName,
            StatementId: `apigateway-${apiId}-${routeKey.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}`,
            Action: "lambda:InvokeFunction",
            Principal: "apigateway.amazonaws.com",
            SourceArn: `arn:aws:execute-api:${this.region}:${this.accountId}:${apiId}/*/*`,
          })
        );
      } catch (err: unknown) {
        // Ignore if permission already exists
        if (err instanceof Error && err.name !== "ResourceConflictException") {
          throw err;
        }
      }
    }

    // Create default stage with auto-deploy
    await this.client.send(
      new CreateStageCommand({
        ApiId: apiId,
        StageName: "$default",
        AutoDeploy: true,
      })
    );

    return { apiId, apiEndpoint };
  }

  /** Delete an HTTP API */
  async deleteHttpApi(apiId: string): Promise<void> {
    try {
      await this.client.send(new DeleteApiCommand({ ApiId: apiId }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotFoundException") {
        return; // Already deleted
      }
      throw err;
    }
  }

  /** Find an existing API by name */
  async findApi(apiName: string): Promise<Api | null> {
    const result = await this.client.send(new GetApisCommand({}));
    return result.Items?.find((api) => api.Name === apiName) || null;
  }
}
