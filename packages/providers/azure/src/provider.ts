/**
 * NovaServe Azure Provider — Real Microsoft Azure Deployment Engine
 *
 * Implements NovaProvider contract for Microsoft Azure using official Azure SDKs,
 * DefaultAzureCredential, Managed Identity RBAC, APIM route diffing, and Azure Monitor.
 */

import type {
  NovaProvider,
  ProviderStatus,
  DeploymentPlan,
  DeploymentPlanAction,
  DeployResult,
  LogEntry,
  LogOptions,
  InvokeResult,
  ValidationResult,
  Resource,
  ResolvedResource,
} from "novaserve-core";
import type { NovaAppConfig } from "novaserve-sdk";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { AzureAuthManager } from "./utils/auth.js";
import { AzureFunctionsService } from "./services/functions.js";
import { AzureIdentityService } from "./services/identity.js";
import { AzureApiManagementService } from "./services/apimanagement.js";
import { AzureStorageService } from "./services/storage.js";
import { AzureQueueService } from "./services/queues.js";
import { AzureCosmosDBService } from "./services/database.js";
import { AzureMonitoringService } from "./services/monitoring.js";
import { AzureKeyVaultService } from "./services/keyvault.js";
import { AzureCacheService } from "./services/cache.js";
import { AzureEventGridService } from "./services/eventgrid.js";
import { AzureSchedulerService } from "./services/scheduler.js";
import { AzureLiveStateInspector } from "./inspector.js";

export class AzureProvider implements NovaProvider {
  readonly name = "azure";
  readonly displayName = "Microsoft Azure";

  private config?: NovaAppConfig;
  private authManager: AzureAuthManager;
  private functions: AzureFunctionsService;
  private identity: AzureIdentityService;
  private apiManagement: AzureApiManagementService;
  private storage: AzureStorageService;
  private sqsQueue: AzureQueueService;
  private cosmosDB: AzureCosmosDBService;
  private monitoring: AzureMonitoringService;
  private keyVault: AzureKeyVaultService;
  private cache: AzureCacheService;
  private eventGrid: AzureEventGridService;
  private scheduler: AzureSchedulerService;
  private inspector: AzureLiveStateInspector;
  private location: string;

  constructor(options?: { subscriptionId?: string; location?: string; resourceGroup?: string }) {
    this.authManager = new AzureAuthManager(options);
    const subId = this.authManager.getSubscriptionId();
    const cred = this.authManager.getCredential();
    this.location = this.authManager.getLocation();

    this.functions = new AzureFunctionsService(cred, subId);
    this.identity = new AzureIdentityService(cred, subId);
    this.apiManagement = new AzureApiManagementService(cred, subId);
    this.storage = new AzureStorageService(cred, subId);
    this.sqsQueue = new AzureQueueService(cred, subId);
    this.cosmosDB = new AzureCosmosDBService(cred, subId);
    this.monitoring = new AzureMonitoringService(cred, subId);
    this.keyVault = new AzureKeyVaultService(cred, subId);
    this.cache = new AzureCacheService(cred, subId);
    this.eventGrid = new AzureEventGridService(cred, subId);
    this.scheduler = new AzureSchedulerService(cred, subId);
    this.inspector = new AzureLiveStateInspector(cred, subId);
  }

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
    if (config.region) {
      this.location = config.region;
    }
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    const errors: Array<{ resource: string; message: string }> = [];
    const warnings: Array<{ resource: string; message: string }> = [];

    for (const res of resources) {
      if (res.name.length < 3) {
        errors.push({
          resource: res.name,
          message: `Resource name "${res.name}" is too short for Azure naming rules (minimum 3 characters).`,
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    const startTime = Date.now();
    const deployedResources: ResolvedResource[] = [];
    const errors: Array<{ resource: string; error: string }> = [];
    const outputs: Record<string, string> = {};

    const appName = plan.appName;
    const envName = plan.environment || "production";
    const resourceGroup = this.authManager.getResourceGroup(appName, envName);

    // Group actions into parallel deployment levels
    const infraActions = plan.actions.filter(
      (a) => a.action !== "skip" && ["storage", "queue", "database"].includes(a.resource.type)
    );
    const functionActions = plan.actions.filter(
      (a) => a.action !== "skip" && a.resource.type === "function"
    );
    const apiActions = plan.actions.filter(
      (a) => a.action !== "skip" && a.resource.type === "api"
    );
    const deleteActions = plan.actions.filter((a) => a.action === "delete");
    const skipActions = plan.actions.filter((a) => a.action === "skip");

    // Process skip actions
    for (const action of skipActions) {
      deployedResources.push({
        type: action.resource.type,
        name: action.resource.name,
        config: action.resource.config,
        dependencies: action.resource.dependencies,
        id: (action.resource as any).id || `azure-${action.resource.type}-${action.resource.name}`,
        configHash: createHash("sha256").update(JSON.stringify(action.resource.config)).digest("hex"),
        status: "deployed",
        outputs: {},
      });
    }

    // Deploy infrastructure resources in parallel
    const infraResults = await Promise.allSettled(
      infraActions.map((action) => this.executeResourceAction(action, appName, resourceGroup))
    );

    for (let i = 0; i < infraResults.length; i++) {
      const res = infraResults[i];
      if (res.status === "fulfilled") {
        deployedResources.push(res.value);
        Object.assign(outputs, res.value.outputs);
      } else {
        errors.push({
          resource: infraActions[i].resource.name,
          error: res.reason instanceof Error ? res.reason.message : String(res.reason),
        });
      }
    }

    // Deploy function resources in parallel
    const functionHostnames: Record<string, string> = {};
    const functionResults = await Promise.allSettled(
      functionActions.map((action) => this.executeResourceAction(action, appName, resourceGroup))
    );

    for (let i = 0; i < functionResults.length; i++) {
      const res = functionResults[i];
      if (res.status === "fulfilled") {
        deployedResources.push(res.value);
        if (res.value.outputs?.hostname) {
          functionHostnames[res.value.name] = res.value.outputs.hostname;
        }
      } else {
        errors.push({
          resource: functionActions[i].resource.name,
          error: res.reason instanceof Error ? res.reason.message : String(res.reason),
        });
      }
    }

    // Deploy API Gateway resources
    for (const action of apiActions) {
      try {
        const apiRes = await this.executeApiAction(action, appName, resourceGroup, functionHostnames);
        deployedResources.push(apiRes);
        Object.assign(outputs, apiRes.outputs);
      } catch (err: any) {
        errors.push({
          resource: action.resource.name,
          error: err.message,
        });
      }
    }

    // Handle deletions in reverse
    for (const action of deleteActions) {
      try {
        await this.deleteResource(action.resource, resourceGroup);
      } catch (err: any) {
        errors.push({
          resource: action.resource.name,
          error: err.message,
        });
      }
    }

    return {
      success: errors.length === 0,
      resources: deployedResources,
      durationMs: Date.now() - startTime,
      errors,
      outputs,
    };
  }

  async destroy(resources: ResolvedResource[]): Promise<void> {
    const appName = this.config?.name || "unknown";
    const resourceGroup = this.authManager.getResourceGroup(appName);

    for (const resource of resources) {
      await this.deleteResource(resource, resourceGroup);
    }
  }

  async *getLogs(resource: string, options?: LogOptions): AsyncIterable<LogEntry> {
    const appName = this.config?.name || "unknown";
    const resourceGroup = this.authManager.getResourceGroup(appName);

    const events = await this.monitoring.getLogEvents(resourceGroup, resource, {
      since: options?.since,
      until: options?.until,
      limit: options?.limit,
    });

    for (const event of events) {
      yield {
        timestamp: event.timestamp,
        level: event.level,
        resource: event.resource,
        message: event.message,
      };
    }
  }

  async invoke(functionName: string, payload: unknown): Promise<InvokeResult> {
    const appName = this.config?.name || "unknown";
    const resourceGroup = this.authManager.getResourceGroup(appName);

    const site = await this.functions.getFunctionApp(resourceGroup, functionName);
    if (!site || !site.hostname) {
      throw new Error(`Azure Function App "${functionName}" is not active in ${resourceGroup}`);
    }

    const result = await this.functions.invokeFunction(site.hostname, functionName, payload);
    return {
      statusCode: result.statusCode,
      body: result.body,
      headers: {},
      durationMs: result.durationMs,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const appName = this.config?.name || "nova-app";
    const authStatus = await this.authManager.getAuthStatus(appName);

    return {
      name: this.displayName,
      configured: authStatus.authenticated,
      region: authStatus.location,
      account: authStatus.subscriptionId,
      warnings: authStatus.authenticated ? [] : ["Azure subscription credentials not found. Run: az login"],
    };
  }

  // ── Private Execution Methods ──────────────────────

  private async executeResourceAction(
    action: DeploymentPlanAction,
    appName: string,
    resourceGroup: string
  ): Promise<ResolvedResource> {
    const resource = action.resource;
    const resourceName = `${appName}-${resource.name}`;
    let resourceId = "";
    const resourceOutputs: Record<string, string> = {};

    switch (resource.type as string) {
      case "function": {
        const codePath = join(process.cwd(), ".nova", "build", `fn-${resource.name}`);
        const config = {
          functionName: resourceName,
          handler: "index.handler",
          runtime: "node20",
          environment: (resource.config.environment as Record<string, string>) || {},
          codePath,
          appName,
        };

        if (action.action === "create" || action.action === "replace") {
          if (action.action === "replace") {
            await this.functions.deleteFunctionApp(resourceGroup, resourceName);
          }
          const state = await this.functions.createFunctionApp(config, resourceGroup, this.location);
          resourceId = state.functionAppId;
          resourceOutputs.hostname = state.hostname;
          resourceOutputs.url = `https://${state.hostname}`;
        } else if (action.action === "update") {
          await this.functions.updateFunctionApp(config, resourceGroup);
          const state = await this.functions.getFunctionApp(resourceGroup, resourceName);
          resourceId = state?.functionAppId || "";
          resourceOutputs.hostname = state?.hostname || "";
        }
        break;
      }

      case "storage": {
        const containerName = (resource.config.containerName as string) || "data";
        if (action.action === "create" || action.action === "replace") {
          if (action.action === "replace") {
            await this.storage.deleteStorageAccount(resourceName, resourceGroup, true);
          }
          resourceId = await this.storage.createStorageAccount(
            resourceName,
            containerName,
            resourceGroup,
            this.location,
            appName
          );
        }
        resourceOutputs[`container_${resource.name}`] = containerName;
        break;
      }

      case "queue": {
        if (action.action === "create" || action.action === "replace") {
          if (action.action === "replace") {
            await this.sqsQueue.deleteQueue(`${appName}-sb`, resourceName, resourceGroup);
          }
          const qRes = await this.sqsQueue.createServiceBusQueue(
            resourceName,
            resourceGroup,
            this.location,
            appName,
            { lockDurationSec: (resource.config.visibilityTimeout as number) || 30 }
          );
          resourceId = qRes.queueId;
          resourceOutputs[`queue_${resource.name}`] = qRes.queueName;
        } else if (action.action === "update") {
          await this.sqsQueue.updateQueueAttributes(`${appName}-sb`, resourceName, resourceGroup, {
            lockDurationSec: (resource.config.visibilityTimeout as number) || 30,
          });
        }
        break;
      }

      case "database": {
        if (action.action === "create" || action.action === "replace") {
          if (action.action === "replace") {
            const accName = `${appName.toLowerCase().replace(/[^a-z0-9]/g, "")}-cosmos`;
            await this.cosmosDB.deleteCosmosContainer(resourceName, accName, resourceGroup);
          }
          resourceId = await this.cosmosDB.createCosmosContainer(
            resourceName,
            resourceGroup,
            this.location,
            appName,
            { partitionKey: (resource.config.partitionKey as string) || "id" }
          );
        }
        break;
      }

      case "secret": {
        const secretValue = (resource.config.value as string) || "";
        if (action.action === "create" || action.action === "update" || action.action === "replace") {
          const kvState = await this.keyVault.createVaultAndSecret(
            resource.name,
            secretValue,
            resourceGroup,
            this.location,
            appName
          );
          resourceId = kvState.secretId;
          resourceOutputs[`secret_${resource.name}_vault`] = kvState.vaultName;
          resourceOutputs[`secret_${resource.name}_uri`] = kvState.vaultUri;
        }
        break;
      }

      case "cache": {
        if (action.action === "create" || action.action === "replace") {
          if (action.action === "replace") {
            await this.cache.deleteCache(resource.name, resourceGroup, appName);
          }
          const cacheState = await this.cache.createCache(
            resource.name,
            resourceGroup,
            this.location,
            appName,
            {
              sku: (resource.config.sku as "Basic" | "Standard" | "Premium") || "Standard",
              capacity: (resource.config.capacity as number) || 1,
            }
          );
          resourceId = cacheState.cacheId;
          resourceOutputs[`cache_${resource.name}_hostname`] = cacheState.hostname;
          resourceOutputs[`cache_${resource.name}_port`] = String(cacheState.sslPort);
          if (cacheState.connectionString) {
            resourceOutputs[`cache_${resource.name}_connection`] = cacheState.connectionString;
          }
        } else if (action.action === "update") {
          await this.cache.updateCache(resource.name, resourceGroup, appName, {
            enableNonSslPort: resource.config.enableNonSslPort as boolean,
          });
        }
        break;
      }

      case "eventBus": {
        if (action.action === "create" || action.action === "replace") {
          if (action.action === "replace") {
            await this.eventGrid.deleteTopic(resource.name, resourceGroup, appName);
          }
          const topicState = await this.eventGrid.createTopic(
            resource.name,
            resourceGroup,
            this.location,
            appName
          );
          resourceId = topicState.topicId;
          resourceOutputs[`event_${resource.name}_endpoint`] = topicState.endpoint;
        }
        break;
      }

      case "cron": {
        const schedule = (resource.config.schedule as string) || "0 0 * * *";
        const handler = (resource.config.handler as string) || "";
        const codePath = join(process.cwd(), ".nova", "build", `cron-${resource.name}`);

        if (action.action === "create" || action.action === "replace") {
          if (action.action === "replace") {
            await this.scheduler.deleteScheduledFunction(resource.name, resourceGroup, appName);
          }
          const cronState = await this.scheduler.createScheduledFunction(
            resource.name,
            schedule,
            resourceGroup,
            this.location,
            appName,
            { handler, codePath, environment: (resource.config.environment as Record<string, string>) || {} }
          );
          resourceId = cronState.functionAppId;
          resourceOutputs[`cron_${resource.name}_schedule`] = cronState.schedule;
        } else if (action.action === "update") {
          await this.scheduler.updateSchedule(resource.name, schedule, resourceGroup, appName);
        }
        break;
      }
    }

    return {
      type: resource.type,
      name: resource.name,
      config: resource.config,
      dependencies: resource.dependencies,
      id: resourceId || `azure-${resource.type}-${resource.name}`,
      configHash: createHash("sha256").update(JSON.stringify(resource.config)).digest("hex"),
      status: "deployed",
      outputs: resourceOutputs,
    };
  }

  private async executeApiAction(
    action: DeploymentPlanAction,
    appName: string,
    resourceGroup: string,
    functionHostnames: Record<string, string>
  ): Promise<ResolvedResource> {
    const resource = action.resource;
    const apimServiceName = `${appName.toLowerCase().replace(/[^a-z0-9]/g, "")}-apim`;
    const routes = (resource.config.routes as Record<string, string>) || {};

    const apiRes = await this.apiManagement.createApi(
      apimServiceName,
      resourceGroup,
      this.location,
      resource.name,
      routes,
      functionHostnames,
      appName
    );

    return {
      type: resource.type,
      name: resource.name,
      config: resource.config,
      dependencies: resource.dependencies,
      id: apiRes.apiId,
      configHash: createHash("sha256").update(JSON.stringify(resource.config)).digest("hex"),
      status: "deployed",
      outputs: {
        apiId: apiRes.apiId,
        url: apiRes.apiEndpoint,
      },
    };
  }

  private async deleteResource(resource: Resource | ResolvedResource, resourceGroup: string): Promise<void> {
    const appName = this.config?.name || "unknown";
    const resourceName = `${appName}-${resource.name}`;

    switch (resource.type as string) {
      case "function":
        await this.functions.deleteFunctionApp(resourceGroup, resourceName);
        break;
      case "storage":
        await this.storage.deleteStorageAccount(resourceName, resourceGroup);
        break;
      case "queue":
        await this.sqsQueue.deleteQueue(`${appName}-sb`, resourceName, resourceGroup);
        break;
      case "database":
        const accName = `${appName.toLowerCase().replace(/[^a-z0-9]/g, "")}-cosmos`;
        await this.cosmosDB.deleteCosmosContainer(resourceName, accName, resourceGroup);
        break;
      case "api":
        await this.apiManagement.deleteApi(
          `${appName.toLowerCase().replace(/[^a-z0-9]/g, "")}-apim`,
          resourceGroup,
          resource.name
        );
        break;
      case "secret":
        await this.keyVault.deleteSecret(resource.name, resourceGroup, appName);
        break;
      case "cache":
        await this.cache.deleteCache(resource.name, resourceGroup, appName);
        break;
      case "eventBus":
        await this.eventGrid.deleteTopic(resource.name, resourceGroup, appName);
        break;
      case "cron":
        await this.scheduler.deleteScheduledFunction(resource.name, resourceGroup, appName);
        break;
    }
  }
}
