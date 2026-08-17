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
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { generateManifests, UNSUPPORTED_TYPES } from "./manifests.js";

export class KubernetesProvider implements NovaProvider {
  readonly name = "kubernetes";
  readonly displayName = "Kubernetes";

  private config?: NovaAppConfig;

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    const errors: Array<{ resource: string; message: string }> = [];
    const warnings: Array<{ resource: string; message: string }> = [];

    for (const resource of resources) {
      if (UNSUPPORTED_TYPES.includes(resource.type)) {
        warnings.push({
          resource: resource.name,
          message: `Resource type '${resource.type}' is not natively supported by the Kubernetes provider. It will be ignored.`,
        });
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
      if (UNSUPPORTED_TYPES.includes(resource.type)) continue;

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

    // Anything left in currentMap needs to be deleted
    for (const [id, resource] of currentMap.entries()) {
      actions.push({
        action: "delete",
        resource: {
          type: resource.type,
          name: resource.name,
          config: resource.config,
          dependencies: resource.dependencies,
        },
        reason: "Resource removed from configuration",
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
        replace: actions.filter((a) => a.action === "replace").length,
        delete: actions.filter((a) => a.action === "delete").length,
        skip: actions.filter((a) => a.action === "skip").length,
      },
    };
  }

  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    const startTime = Date.now();
    
    const outDir = join(process.cwd(), ".nova", "kubernetes");
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const resourcesToDeploy = plan.actions
      .filter((a) => a.action !== "delete")
      .map((a) => a.resource);
      
    // Default namespace to app name if not provided
    const k8sConfig = (this.config as any)?.kubernetes || {};
    const namespace = k8sConfig.namespace || this.config?.name || "default";

    const yaml = generateManifests(resourcesToDeploy, namespace);
    writeFileSync(join(outDir, "resources.yaml"), yaml);

    const kustomization = `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - resources.yaml
`;
    writeFileSync(join(outDir, "kustomization.yaml"), kustomization);

    let applyMsg = "Manifests generated in .nova/kubernetes (kubectl apply skipped)";
    const shouldApply = k8sConfig.apply !== false; // Auto-apply unless explicitly disabled

    if (shouldApply) {
      try {
        const args = ["apply", "-k", outDir];
        if (k8sConfig.context) {
          args.push("--context", k8sConfig.context);
        }
        execFileSync("kubectl", args, { stdio: "inherit" });
        applyMsg = "Applied manifests to Kubernetes cluster";
      } catch (e: any) {
        console.warn("Failed to apply manifests using kubectl. Ensure it is installed and configured.", e.message);
      }
    }

    const deployedResources: ResolvedResource[] = plan.actions
      .filter((a) => a.action !== "skip" && a.action !== "delete")
      .map((action) => ({
        type: action.resource.type,
        name: action.resource.name,
        config: action.resource.config,
        dependencies: action.resource.dependencies,
        id: `kubernetes:${action.resource.type}:${action.resource.name}`,
        configHash: createHash("sha256")
          .update(JSON.stringify(action.resource.config))
          .digest("hex"),
        status: "deployed",
        outputs: {},
      }));

    return {
      success: true,
      resources: deployedResources,
      durationMs: Date.now() - startTime,
      errors: [],
      outputs: {
        kubernetes: applyMsg,
      },
    };
  }

  async destroy(resources: ResolvedResource[]): Promise<void> {
    const outDir = join(process.cwd(), ".nova", "kubernetes");
    if (existsSync(outDir)) {
      try {
        const k8sConfig = (this.config as any)?.kubernetes || {};
        const args = ["delete", "-k", outDir];
        if (k8sConfig.context) {
          args.push("--context", k8sConfig.context);
        }
        execFileSync("kubectl", args, { stdio: "inherit" });
      } catch (e: any) {
        console.warn("Failed to delete using kubectl.", e.message);
      }
      rmSync(outDir, { recursive: true, force: true });
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
      message: "Streaming kubectl logs -l app=" + resource + " coming soon...",
    };
  }

  async invoke(functionName: string, payload: unknown): Promise<InvokeResult> {
    return {
      statusCode: 501,
      body: { message: "Direct invoke is not natively supported for Kubernetes provider." },
      headers: {},
      durationMs: 0,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    let context = "unknown";
    try {
      context = execFileSync("kubectl", ["config", "current-context"], { encoding: "utf8" }).trim();
    } catch (e) {
      // Ignored
    }
    
    return {
      name: this.displayName,
      configured: context !== "unknown",
      region: "cluster",
      account: context,
    };
  }
}
