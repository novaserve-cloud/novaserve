/**
 * AWS API Gateway v2 (HTTP API) Service — Real Operations
 *
 * Creates HTTP APIs, routes, and Lambda integrations using AWS SDK v3.
 * Supports incremental route diffing, target function updating, integration/permission cleanup,
 * full ownership tagging, and exponential backoff retry handling.
 */

import {
  ApiGatewayV2Client,
  CreateApiCommand,
  UpdateApiCommand,
  DeleteApiCommand,
  CreateIntegrationCommand,
  UpdateIntegrationCommand,
  DeleteIntegrationCommand,
  GetIntegrationsCommand,
  CreateRouteCommand,
  DeleteRouteCommand,
  CreateStageCommand,
  UpdateStageCommand,
  GetApisCommand,
  GetRoutesCommand,
  type Api,
} from "@aws-sdk/client-apigatewayv2";
import { LambdaClient, AddPermissionCommand, RemovePermissionCommand } from "@aws-sdk/client-lambda";
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
            "novaserve:version": "2.0.0",
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
   * Update an existing HTTP API in-place by diffing routes (adding new, updating target, deleting removed)
   */
  async updateHttpApi(
    apiId: string,
    routes: Record<string, string>,
    functionArns: Record<string, string>,
    appName: string
  ): Promise<void> {
    // 1. Fetch existing routes & integrations
    const getRoutesRes = await awsRetry(() =>
      this.client.send(new GetRoutesCommand({ ApiId: apiId }))
    );
    const getIntegrationsRes = await awsRetry(() =>
      this.client.send(new GetIntegrationsCommand({ ApiId: apiId }))
    );

    const existingItems = getRoutesRes.Items || [];
    const existingIntegrations = new Map<string, string>(); // integrationId -> integrationUri
    for (const integ of getIntegrationsRes.Items || []) {
      if (integ.IntegrationId && integ.IntegrationUri) {
        existingIntegrations.set(integ.IntegrationId, integ.IntegrationUri);
      }
    }

    const existingRoutes = new Map<string, { routeId: string; target?: string }>(); // routeKey -> { routeId, target }
    for (const r of existingItems) {
      if (r.RouteKey && r.RouteId) {
        existingRoutes.set(r.RouteKey, { routeId: r.RouteId, target: r.Target });
      }
    }

    const desiredKeys = new Set(Object.keys(routes));

    // 2. Delete removed routes & orphan integrations & Lambda permissions
    for (const [routeKey, routeInfo] of existingRoutes.entries()) {
      if (!desiredKeys.has(routeKey)) {
        await awsRetry(() =>
          this.client.send(new DeleteRouteCommand({ ApiId: apiId, RouteId: routeInfo.routeId }))
        );

        if (routeInfo.target && routeInfo.target.startsWith("integrations/")) {
          const integId = routeInfo.target.replace("integrations/", "");
          try {
            await awsRetry(() =>
              this.client.send(new DeleteIntegrationCommand({ ApiId: apiId, IntegrationId: integId }))
            );
          } catch {
            // Ignore if integration already removed
          }
        }

        const statementId = `apigateway-${apiId}-${routeKey.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}`;
        try {
          await awsRetry(() =>
            this.lambdaClient.send(
              new RemovePermissionCommand({
                FunctionName: `${appName}-${routeKey.split(/\s+/).pop()?.replace(/[^a-zA-Z0-9-_]/g, "") || "fn"}`,
                StatementId: statementId,
              })
            )
          );
        } catch {
          // Ignore permission removal error
        }
      }
    }

    // 3. Add or update desired routes
    await this.syncRoutes(apiId, routes, functionArns, appName, existingRoutes, existingIntegrations);

    // 4. Ensure stage auto-deploy remains enabled
    try {
      await awsRetry(() =>
        this.client.send(
          new UpdateStageCommand({
            ApiId: apiId,
            StageName: "$default",
            AutoDeploy: true,
          })
        )
      );
    } catch {
      // Stage exists and auto-deploy is active
    }
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
    existingRoutes?: Map<string, { routeId: string; target?: string }>,
    existingIntegrations?: Map<string, string>
  ): Promise<void> {
    for (const [routeKey, handlerRef] of Object.entries(routes)) {
      const functionArn = functionArns[handlerRef];
      if (!functionArn) continue;

      const existingRoute = existingRoutes?.get(routeKey);

      if (existingRoute && existingRoute.target) {
        const integId = existingRoute.target.replace("integrations/", "");
        const currentUri = existingIntegrations?.get(integId);

        // If target function ARN matches current integration, route is up-to-date
        if (currentUri === functionArn) {
          continue;
        }

        // Update existing integration target if handler changed
        if (integId) {
          await awsRetry(() =>
            this.client.send(
              new UpdateIntegrationCommand({
                ApiId: apiId,
                IntegrationId: integId,
                IntegrationUri: functionArn,
              })
            )
          );
          continue;
        }
      }

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
