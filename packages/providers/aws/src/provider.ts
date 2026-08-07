/**
 * AWS Provider
 *
 * Implements the NovaProvider interface for Amazon Web Services.
 * Maps NovaServe resources to AWS CloudFormation/SDK calls.
 *
 * Supported services:
 * - Lambda (functions)
 * - API Gateway v2 (HTTP APIs)
 * - S3 (storage)
 * - SQS (queues)
 * - EventBridge (cron/scheduled events)
 * - IAM (auto-generated permissions)
 */

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

export class AWSProvider implements NovaProvider {
  readonly name = "aws";
  readonly displayName = "Amazon Web Services";

  private config?: NovaAppConfig;
  private region: string = "us-east-1";

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
    this.region = config.region || "us-east-1";

    // Verify AWS credentials
    // In production, this would check AWS SDK credential chain
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    const errors: Array<{ resource: string; message: string }> = [];
    const warnings: Array<{ resource: string; message: string }> = [];

    for (const resource of resources) {
      // Validate resource-specific constraints
      switch (resource.type) {
        case "function": {
          const memory = (resource.config.memory as number) || 256;
          if (memory < 128 || memory > 10240) {
            errors.push({
              resource: resource.name,
              message: `Lambda memory must be 128-10240 MB, got ${memory}`,
            });
          }
          break;
        }
        case "storage": {
          // S3 bucket name validation
          if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(resource.name)) {
            warnings.push({
              resource: resource.name,
              message: "S3 bucket names must be lowercase with dots and hyphens only",
            });
          }
          break;
        }
      }
    }

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

    // Resources to delete
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
    const errors: Array<{ resource: string; error: string }> = [];

    // Execute actions in dependency order
    for (const action of plan.actions) {
      if (action.action === "skip") continue;

      try {
        const result = await this.executeAction(action);
        deployedResources.push(result);
      } catch (error) {
        errors.push({
          resource: action.resource.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: errors.length === 0,
      resources: deployedResources,
      durationMs: Date.now() - startTime,
      errors,
      outputs: this.collectOutputs(deployedResources),
    };
  }

  async destroy(resources: ResolvedResource[]): Promise<void> {
    // Delete resources in reverse dependency order
    const reversed = [...resources].reverse();
    for (const resource of reversed) {
      console.log(`  Destroying ${resource.type}/${resource.name}...`);
      // AWS SDK calls would go here
    }
  }

  async *getLogs(
    resource: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    // CloudWatch Logs integration would go here
    yield {
      timestamp: new Date(),
      level: "info",
      resource,
      message: "AWS CloudWatch Logs integration coming soon",
    };
  }

  async invoke(functionName: string, payload: unknown): Promise<InvokeResult> {
    // Lambda.invoke() call would go here
    return {
      statusCode: 200,
      body: { message: `Lambda invocation for ${functionName}` },
      headers: {},
      durationMs: 0,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      name: this.displayName,
      configured: true,
      region: this.region,
      account: "AWS account",
      warnings: ["Full AWS deployment coming in Phase 2"],
    };
  }

  // ── Private ──────────────────────────────────────────

  private async executeAction(
    action: DeploymentPlanAction
  ): Promise<ResolvedResource> {
    // This is where AWS SDK calls would be made
    // For MVP, we simulate the deployment
    return {
      type: action.resource.type,
      name: action.resource.name,
      config: action.resource.config,
      dependencies: action.resource.dependencies,
      id: `arn:aws:lambda:${this.region}:123456:function:${action.resource.name}`,
      configHash: createHash("sha256")
        .update(JSON.stringify(action.resource.config))
        .digest("hex"),
      status: "deployed",
      outputs: {},
    };
  }

  private collectOutputs(
    resources: ResolvedResource[]
  ): Record<string, string> {
    const outputs: Record<string, string> = {};

    for (const resource of resources) {
      if (resource.type === "api") {
        outputs.api = `https://${resource.id}.execute-api.${this.region}.amazonaws.com`;
      }
      if (resource.type === "storage") {
        outputs[`bucket_${resource.name}`] = `s3://${resource.name}`;
      }
    }

    return outputs;
  }
}
