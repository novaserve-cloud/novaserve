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
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export class DockerProvider implements NovaProvider {
  readonly name = "docker";
  readonly displayName = "Docker & Kubernetes";

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
    
    // Generate Dockerfile and docker-compose.yml
    const outDir = join(process.cwd(), ".nova", "docker");
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const dockerfile = `
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install --production
CMD ["npm", "start"]
    `.trim();

    writeFileSync(join(outDir, "Dockerfile"), dockerfile);

    const compose = `
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    `.trim();

    writeFileSync(join(outDir, "docker-compose.yml"), compose);

    const deployedResources: ResolvedResource[] = plan.actions
      .filter((a) => a.action !== "skip")
      .map((action) => ({
        type: action.resource.type,
        name: action.resource.name,
        config: action.resource.config,
        dependencies: action.resource.dependencies,
        id: `docker:${action.resource.type}:${action.resource.name}`,
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
        docker: "Generated Dockerfile and docker-compose.yml in .nova/docker/",
      },
    };
  }

  async destroy(resources: ResolvedResource[]): Promise<void> {
    // Implement destroy logic for Docker
  }

  async *getLogs(
    resource: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    yield {
      timestamp: new Date(),
      level: "info",
      resource,
      message: "Docker logs coming soon",
    };
  }

  async invoke(functionName: string, payload: unknown): Promise<InvokeResult> {
    return {
      statusCode: 200,
      body: { message: "Docker container invoked" },
      headers: {},
      durationMs: 0,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      name: this.displayName,
      configured: true,
      region: "local",
      account: "Docker Daemon",
    };
  }
}
