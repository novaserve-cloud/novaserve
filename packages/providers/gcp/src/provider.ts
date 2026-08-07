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

export class GCPProvider implements NovaProvider {
  readonly name = "gcp";
  readonly displayName = "Google Cloud Platform";

  private config?: NovaAppConfig;

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    const errors: Array<{ resource: string; message: string }> = [];
    const warnings: Array<{ resource: string; message: string }> = [];

    return { valid: errors.length === 0, errors, warnings };
  }

  async plan(
    resources: Resource[],
    currentState: ResolvedResource[]
  ): Promise<DeploymentPlan> {
    const currentMap = new Map<string, ResolvedResource>();
    for (const r of currentState) {
      currentMap.set(`${r.type}-${r.name}`, r);
    }

    const actions: DeploymentPlanAction[] = [];

    for (const resource of resources) {
      const id = `${resource.type}-${resource.name}`;
      const existing = currentMap.get(id);

      if (!existing) {
        actions.push({
          action: "create",
          resource,
          reason: "New resource",
          dependsOn: resource.dependencies,
        });
      } else {
        const newHash = createHash("sha256")
          .update(JSON.stringify(resource.config))
          .digest("hex");

        if (newHash !== existing.configHash) {
          actions.push({
            action: "update",
            resource,
            reason: "Configuration changed",
            dependsOn: resource.dependencies,
          });
        } else {
          actions.push({
            action: "skip",
            resource,
            reason: "No changes",
            dependsOn: [],
          });
        }
        currentMap.delete(id);
      }
    }

    for (const resource of currentMap.values()) {
      actions.push({
        action: "delete",
        resource,
        reason: "Removed from config",
        dependsOn: [],
      });
    }

    return {
      appName: this.config?.name || "unknown",
      provider: this.name,
      environment: "production",
      actions,
      summary: {
        create: actions.filter((a) => a.action === "create").length,
        update: actions.filter((a) => a.action === "update").length,
        delete: actions.filter((a) => a.action === "delete").length,
        skip: actions.filter((a) => a.action === "skip").length,
      },
    };
  }

  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    const startTime = Date.now();
    const deployedResources: ResolvedResource[] = [];

    for (const action of plan.actions) {
      if (action.action === "skip") continue;
      
      deployedResources.push({
        type: action.resource.type,
        name: action.resource.name,
        config: action.resource.config,
        dependencies: action.resource.dependencies,
        id: `projects/my-gcp-project/locations/us-central1/functions/${action.resource.name}`,
        configHash: createHash("sha256")
          .update(JSON.stringify(action.resource.config))
          .digest("hex"),
        status: "deployed",
        outputs: {},
      });
    }

    return {
      success: true,
      resources: deployedResources,
      durationMs: Date.now() - startTime,
      errors: [],
      outputs: {},
    };
  }

  async destroy(resources: ResolvedResource[]): Promise<void> {
    // Implement destroy logic for GCP
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
    return {
      name: this.displayName,
      configured: true,
      region: "us-central1",
      account: "GCP Project",
    };
  }
}
