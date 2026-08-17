import type {
  NovaProvider,
  ProviderStatus,
  DeploymentPlan,
  DeployResult,
  LogEntry,
  LogOptions,
  InvokeResult,
  ValidationResult,
  DeploymentPlanAction,
} from "novaserve-core";
import type { Resource, ResolvedResource } from "novaserve-core";
import type { NovaAppConfig } from "novaserve-sdk";
import { createHash } from "node:crypto";
import { GCPAuthManager, GCPCredentials } from "./utils/auth.js";
import { GCPFunctionsService } from "./services/functions.js";
import { GCPStorageService } from "./services/storage.js";
import { GCPDatabaseService } from "./services/database.js";
import { GCPPubSubService } from "./services/pubsub.js";
import { GCPSchedulerService } from "./services/scheduler.js";
import { GCPMemorystoreService } from "./services/memorystore.js";
import { GCPSecretManagerService } from "./services/secretmanager.js";
import { GCPApiGatewayService } from "./services/apigateway.js";
import { GCPIamService } from "./services/iam.js";

export class GCPProvider implements NovaProvider {
  readonly name = "gcp";
  readonly displayName = "Google Cloud Platform";

  private config?: NovaAppConfig;
  private functions!: GCPFunctionsService;
  private storage!: GCPStorageService;
  private database!: GCPDatabaseService;
  private pubsub!: GCPPubSubService;
  private scheduler!: GCPSchedulerService;
  private memorystore!: GCPMemorystoreService;
  private secrets!: GCPSecretManagerService;
  private apigateway!: GCPApiGatewayService;
  private iam!: GCPIamService;
  private projectId!: string;
  private region!: string;
  private authClient!: any;

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
    const creds = await GCPAuthManager.getCredentials(this.config as unknown as Record<string, unknown>);
    this.projectId = creds.projectId;
    this.region = creds.region;
    this.authClient = creds.auth;

    this.functions = new GCPFunctionsService(this.projectId, this.region);
    this.storage = new GCPStorageService(this.projectId, this.region);
    this.database = new GCPDatabaseService(this.projectId, this.region, this.authClient);
    this.pubsub = new GCPPubSubService(this.projectId);
    this.scheduler = new GCPSchedulerService(this.projectId, this.region);
    this.memorystore = new GCPMemorystoreService(this.projectId, this.region);
    this.secrets = new GCPSecretManagerService(this.projectId);
    this.apigateway = new GCPApiGatewayService(this.projectId, this.region);
    this.iam = new GCPIamService(this.projectId);
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    const errors: Array<{ resource: string; message: string }> = [];
    const warnings: Array<{ resource: string; message: string }> = [];

    return { valid: errors.length === 0, errors, warnings };
  }



  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    if (!this.functions) {
      await this.init(this.config || ({} as NovaAppConfig));
    }
    const startTime = Date.now();
    const deployedResources: ResolvedResource[] = [];
    const outputs: Record<string, string> = {};
    const errors: Array<{ resource: string; error: string }> = [];

    const appName = plan.appName || "app";

    for (const action of plan.actions) {
      if (action.action === "skip") continue;
      
      const res = action.resource;
      const physicalName = `${appName}-${res.name}`;
      let providerId = "";

      try {
        if (action.action === "create" || action.action === "update" || action.action === "replace") {
          switch (res.type) {
            case "function": {
              providerId = await this.functions.createFunction(physicalName, res.config.environment as Record<string, string> || {});
              outputs[`${res.name}_url`] = `https://${this.region}-${this.projectId}.cloudfunctions.net/${physicalName}`;
              break;
            }
            case "storage": {
              providerId = await this.storage.createBucket(physicalName);
              outputs[`${res.name}_bucket`] = physicalName;
              break;
            }
            case "database": {
              const engine = (res.config.engine as string) || "postgres";
              providerId = await this.database.createDatabase(physicalName, engine, res.config);
              outputs[`${res.name}_db`] = providerId;
              break;
            }
            case "queue": {
              providerId = await this.pubsub.createTopic(physicalName);
              outputs[`${res.name}_topic`] = providerId;
              break;
            }
            case "cron": {
              const schedule = (res.config.schedule as string) || "0 * * * *";
              const targetUri = `https://${this.region}-${this.projectId}.cloudfunctions.net/${physicalName}-worker`;
              providerId = await this.scheduler.createJob(physicalName, schedule, targetUri);
              break;
            }
            case "cache": {
              providerId = await this.memorystore.createInstance(physicalName);
              outputs[`${res.name}_redis`] = providerId;
              break;
            }
            case "secret": {
              providerId = await this.secrets.createSecret(physicalName);
              break;
            }
            case "api": {
              providerId = await this.apigateway.createApi(physicalName);
              outputs[`${res.name}_api`] = providerId;
              break;
            }
          }

          if (res.type === "function") {
            for (const dep of res.dependencies) {
              const depType = dep.split("-")[0];
              await this.iam.assignRole(depType);
            }
          }

          deployedResources.push({
            type: res.type,
            name: res.name,
            config: res.config,
            dependencies: res.dependencies,
            id: providerId || `${res.type}-${res.name}`,
            configHash: createHash("sha256").update(JSON.stringify(res.config)).digest("hex"),
            provider: this.name,
            providerId: providerId || `${res.type}-${res.name}`,
            status: "deployed",
            outputs,
          });
        } else if (action.action === "delete") {
          switch (res.type) {
            case "function":
              await this.functions.deleteFunction(physicalName);
              break;
            case "storage":
              await this.storage.deleteBucket(physicalName);
              break;
            case "database":
              await this.database.deleteDatabase(physicalName);
              break;
            case "queue":
              await this.pubsub.deleteTopic(physicalName);
              break;
            case "cron":
              await this.scheduler.deleteJob(physicalName);
              break;
            case "cache":
              await this.memorystore.deleteInstance(physicalName);
              break;
            case "secret":
              await this.secrets.deleteSecret(physicalName);
              break;
            case "api":
              await this.apigateway.deleteApi(physicalName);
              break;
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push({ resource: res.name, error: errMsg });
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
    if (!this.functions) {
      await this.init(this.config || ({} as NovaAppConfig));
    }
    for (const res of resources) {
      try {
        if (res.type === "function") {
          await this.functions.deleteFunction(res.name); // Note: Assuming res.name is physical name, else we need appName.
        } else if (res.type === "storage") {
          await this.storage.deleteBucket(res.name);
        } else if (res.type === "database") {
          await this.database.deleteDatabase(res.name);
        } else if (res.type === "queue") {
          await this.pubsub.deleteTopic(res.name);
        } else if (res.type === "cron") {
          await this.scheduler.deleteJob(res.name);
        } else if (res.type === "cache") {
          await this.memorystore.deleteInstance(res.name);
        } else if (res.type === "secret") {
          await this.secrets.deleteSecret(res.name);
        } else if (res.type === "api") {
          await this.apigateway.deleteApi(res.name);
        }
      } catch {
        // Continue cleanup
      }
    }
  }

  async *getLogs(
    resource: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    yield {
      timestamp: new Date(),
      level: "info",
      resource,
      message: "GCP Cloud Logging coming soon",
    };
  }

  async invoke(functionName: string, payload: unknown): Promise<InvokeResult> {
    return {
      statusCode: 200,
      body: { message: "GCP function invoked" },
      headers: {},
      durationMs: 0,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    let creds: GCPCredentials | undefined;
    let valid = false;
    try {
      creds = await GCPAuthManager.getCredentials(this.config as unknown as Record<string, unknown>);
      valid = GCPAuthManager.isConfigured(creds);
    } catch {
      valid = false;
    }

    return {
      name: this.displayName,
      configured: valid,
      region: creds?.region || "us-central1",
      account: creds?.projectId || "Unconfigured",
    };
  }
}
