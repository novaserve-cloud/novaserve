/**
 * Docker Provider — Production-Grade Container Deployment
 *
 * Implements the NovaProvider interface for Docker-based deployments.
 * Generates production-ready Dockerfiles, Compose files, and deployment artifacts.
 *
 * Deployment Lifecycle:
 *   validate → generate → build → tag → deploy → health check → ready
 *
 * Supports:
 *   - Local production deployments
 *   - On-premise / self-hosted infrastructure
 *   - VPS deployments
 *   - Private cloud
 *   - CI/CD environments
 *   - Air-gapped environments (with pre-built images)
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
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

import type {
  DockerProviderConfig,
  DockerProviderOptions,
  DockerClient,
  DockerDeploymentContext,
  DockerDeploymentMetadata,
  ComposeFile,
} from "./types.js";
import { ShellDockerClient } from "./client.js";
import { generateDockerfile, detectLockfileFromProject } from "./generators/dockerfile.js";
import { generateComposeFile, serializeComposeFile, sanitizeDockerName } from "./generators/compose.js";
import { generateEnvExample, generateEnvTemplate } from "./generators/env.js";
import { generateDockerignore } from "./generators/dockerignore.js";
import { validateDockerConfig } from "./validators.js";
import { waitForDeploymentHealth } from "./health.js";

export class DockerProvider implements NovaProvider {
  readonly name = "docker";
  readonly displayName = "Docker";

  private config?: NovaAppConfig;
  private dockerConfig: DockerProviderConfig = {};
  private client: DockerClient;
  private readonly now: () => Date;

  constructor(options: DockerProviderOptions = {}) {
    this.client = options.client || new ShellDockerClient();
    this.now = options.now || (() => new Date());
  }

  // ── Lifecycle ───────────────────────────────────────────────

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
    this.dockerConfig = (config as unknown as Record<string, unknown>).docker as DockerProviderConfig || {};
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    return validateDockerConfig(resources, this.dockerConfig, this.client);
  }

  // ── Planning ────────────────────────────────────────────────

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

    // Detect removed resources
    for (const resource of currentMap.values()) {
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
      environment: this.dockerConfig.stage || "production",
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

  // ── Deployment ──────────────────────────────────────────────

  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    const startTime = Date.now();
    const errors: Array<{ resource: string; error: string }> = [];
    const outputs: Record<string, string> = {};
    const appName = plan.appName;

    const ctx = this.buildContext(appName, plan.environment);
    const resources = plan.actions
      .filter((a) => a.action !== "delete")
      .map((a) => a.resource);

    const runtime = this.config?.runtime || "node20";

    // ── Phase 1: Generate Artifacts ──────────────────────
    try {
      this.generateArtifacts(ctx, resources, runtime);
      outputs.artifactDir = ctx.outputDir;
      outputs.dockerfile = join(ctx.outputDir, "Dockerfile");
      outputs.compose = join(ctx.outputDir, "compose.yaml");
    } catch (error) {
      return this.failResult(startTime, [{
        resource: "artifact-generation",
        error: formatError("Artifact Generation", "generate", error,
          "Check file permissions and disk space in the .nova/docker/ directory."),
      }]);
    }

    // ── Phase 2: Build Images ────────────────────────────
    const imageTag = this.resolveImageTag(ctx);
    const imageName = this.resolveImageName(ctx);
    const fullImageRef = `${imageName}:${imageTag}`;

    try {
      const buildResult = await this.client.build({
        dockerfile: join(ctx.outputDir, "Dockerfile"),
        context: ctx.projectRoot,
        tags: [fullImageRef],
        buildKit: this.dockerConfig.build?.buildKit !== false,
        platform: this.dockerConfig.build?.platform,
        buildArgs: this.dockerConfig.build?.args,
        cacheFrom: this.dockerConfig.build?.cacheFrom,
        sbom: this.dockerConfig.build?.sbom,
        provenance: this.dockerConfig.build?.provenance,
      });

      if (!buildResult.success) {
        return this.failResult(startTime, [{
          resource: "docker-build",
          error: formatError("Docker Build", "build", buildResult.error,
            "Check Dockerfile syntax, ensure all COPY sources exist, and verify base images are accessible."),
        }]);
      }

      outputs.imageTag = imageTag;
      outputs.imageRef = fullImageRef;
      if (buildResult.imageId) outputs.imageId = buildResult.imageId;
      if (buildResult.digest) outputs.imageDigest = buildResult.digest;
      outputs.buildDuration = `${(buildResult.durationMs / 1000).toFixed(1)}s`;
    } catch (error) {
      return this.failResult(startTime, [{
        resource: "docker-build",
        error: formatError("Docker Build", "build", error,
          "Ensure Docker daemon is running and BuildKit is supported."),
      }]);
    }

    // ── Phase 3: Deploy Services ─────────────────────────
    const composeFile = join(ctx.outputDir, "compose.yaml");

    try {
      const upResult = await this.client.composeUp({
        composeFile,
        projectName: ctx.projectName,
        detach: true,
        build: false, // Already built
        forceRecreate: true,
        removeOrphans: true,
        timeout: this.dockerConfig.stopGracePeriod || 30,
      });

      if (!upResult.success) {
        return this.failResult(startTime, [{
          resource: "docker-compose",
          error: formatError("Docker Compose", "deploy", upResult.error,
            `Inspect logs using: docker compose -p ${ctx.projectName} logs`),
        }]);
      }
    } catch (error) {
      return this.failResult(startTime, [{
        resource: "docker-compose",
        error: formatError("Docker Compose", "deploy", error,
          `Inspect logs using: docker compose -p ${ctx.projectName} logs`),
      }]);
    }

    // ── Phase 4: Health Verification ─────────────────────
    const serviceNames = this.extractServiceNames(resources, ctx);
    const healthConfig = this.dockerConfig.healthCheck || { type: "http" as const, endpoint: "/health" };

    if (healthConfig.type !== "none" && serviceNames.length > 0) {
      try {
        const healthResult = await waitForDeploymentHealth(
          this.client,
          ctx.projectName,
          serviceNames,
          healthConfig,
          composeFile
        );

        if (!healthResult.healthy) {
          // Deployment failed health verification
          const unhealthyServices = healthResult.services
            .filter((s) => !s.healthy)
            .map((s) => `${s.service}: ${s.error || "unhealthy"}`)
            .join("; ");

          return this.failResult(startTime, [{
            resource: "health-check",
            error: formatError("Health Check", "verify", unhealthyServices,
              `Inspect logs: docker compose -p ${ctx.projectName} logs\n` +
              `Check containers: docker compose -p ${ctx.projectName} ps`),
          }]);
        }

        outputs.healthCheckDuration = `${(healthResult.durationMs / 1000).toFixed(1)}s`;
        outputs.healthStatus = "all services healthy";
      } catch (error) {
        errors.push({
          resource: "health-check",
          error: `Health verification error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // ── Phase 5: Registry Push (optional) ────────────────
    if (this.dockerConfig.registry?.push) {
      try {
        const registryImage = this.resolveRegistryImage(ctx, imageTag);
        await this.client.imageTag(fullImageRef, registryImage);
        const pushResult = await this.client.imagePush(registryImage);

        if (pushResult.success) {
          outputs.registryImage = registryImage;
          if (pushResult.digest) outputs.registryDigest = pushResult.digest;
        } else {
          errors.push({
            resource: "registry-push",
            error: formatError("Registry Push", "push", pushResult.error,
              "Ensure docker login has been run for the target registry."),
          });
        }
      } catch (error) {
        errors.push({
          resource: "registry-push",
          error: formatError("Registry Push", "push", error,
            "Check registry authentication and network connectivity."),
        });
      }
    }

    // ── Phase 6: Save Deployment Metadata ────────────────
    const metadata = this.buildMetadata(ctx, imageTag, fullImageRef);
    this.saveDeploymentMetadata(ctx, metadata);

    // ── Build Result ─────────────────────────────────────
    const deployedResources: ResolvedResource[] = plan.actions
      .filter((a) => a.action !== "skip" && a.action !== "delete")
      .map((action) => ({
        type: action.resource.type,
        name: action.resource.name,
        config: action.resource.config,
        dependencies: action.resource.dependencies,
        id: `docker:${ctx.projectName}:${action.resource.type}:${action.resource.name}`,
        configHash: createHash("sha256")
          .update(JSON.stringify(action.resource.config))
          .digest("hex"),
        status: "deployed" as const,
        provider: "docker",
        providerId: `docker:${ctx.projectName}:${action.resource.name}`,
        outputs: {},
      }));

    // Add skipped resources
    const skippedResources: ResolvedResource[] = plan.actions
      .filter((a) => a.action === "skip")
      .map((action) => ({
        type: action.resource.type,
        name: action.resource.name,
        config: action.resource.config,
        dependencies: action.resource.dependencies,
        id: `docker:${ctx.projectName}:${action.resource.type}:${action.resource.name}`,
        configHash: createHash("sha256")
          .update(JSON.stringify(action.resource.config))
          .digest("hex"),
        status: "deployed" as const,
        provider: "docker",
        outputs: {},
      }));

    outputs.projectName = ctx.projectName;
    outputs.composeFile = composeFile;

    return {
      success: errors.length === 0,
      resources: [...deployedResources, ...skippedResources],
      durationMs: Date.now() - startTime,
      errors,
      outputs,
    };
  }

  // ── Destroy ─────────────────────────────────────────────────

  async destroy(resources: ResolvedResource[]): Promise<void> {
    const appName = this.config?.name || "unknown";
    const environment = this.dockerConfig.stage || "production";
    const ctx = this.buildContext(appName, environment);
    const composeFile = join(ctx.outputDir, "compose.yaml");

    if (!existsSync(composeFile)) {
      console.warn(`[NovaServe Docker] No compose file found at ${composeFile}. Nothing to destroy.`);
      return;
    }

    try {
      await this.client.composeDown({
        composeFile,
        projectName: ctx.projectName,
        volumes: false, // Don't delete volumes by default (data safety)
        timeout: this.dockerConfig.stopGracePeriod || 30,
      });
    } catch (error) {
      throw new Error(
        `Docker provider: failed to destroy services for project '${ctx.projectName}'.\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}\n` +
        `Manual cleanup: docker compose -p ${ctx.projectName} down --volumes`
      );
    }
  }

  // ── Logs ────────────────────────────────────────────────────

  async *getLogs(
    resource: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    const appName = this.config?.name || "unknown";
    const environment = this.dockerConfig.stage || "production";
    const ctx = this.buildContext(appName, environment);
    const composeFile = join(ctx.outputDir, "compose.yaml");

    const logOptions: { follow?: boolean; since?: string; tail?: number; composeFile?: string } = {
      composeFile,
    };

    if (options?.follow) logOptions.follow = true;
    if (options?.since) logOptions.since = options.since.toISOString();
    if (options?.limit) logOptions.tail = options.limit;

    for await (const line of this.client.composeLogs(ctx.projectName, resource, logOptions)) {
      yield {
        timestamp: line.timestamp,
        level: line.stream === "stderr" ? "error" : "info",
        resource: line.service,
        message: line.message,
      };
    }
  }

  // ── Invoke ──────────────────────────────────────────────────

  async invoke(functionName: string, payload: unknown): Promise<InvokeResult> {
    const appName = this.config?.name || "unknown";
    const environment = this.dockerConfig.stage || "production";
    const ctx = this.buildContext(appName, environment);

    const containers = await this.client.composePs(ctx.projectName);
    const container = containers.find((c) =>
      c.service.includes(functionName) || c.name.includes(functionName)
    );

    if (!container) {
      return {
        statusCode: 503,
        body: { error: `Service '${functionName}' not found in project '${ctx.projectName}'` },
        headers: {},
        durationMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.client.exec(container.name, [
        "node", "-e", `
          const handler = require('./dist/index.js');
          const event = ${JSON.stringify(payload)};
          Promise.resolve(handler.handler ? handler.handler(event) : handler.default(event))
            .then(r => process.stdout.write(JSON.stringify(r)))
            .catch(e => { process.stderr.write(e.message); process.exit(1); });
        `,
      ]);

      if (result.exitCode !== 0) {
        return {
          statusCode: 500,
          body: { error: result.stderr },
          headers: {},
          durationMs: Date.now() - startTime,
        };
      }

      let body: unknown;
      try {
        body = JSON.parse(result.stdout);
      } catch {
        body = result.stdout;
      }

      return {
        statusCode: 200,
        body,
        headers: {},
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: { error: error instanceof Error ? error.message : String(error) },
        headers: {},
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ── Status ──────────────────────────────────────────────────

  async getStatus(): Promise<ProviderStatus> {
    const status = await this.client.getStatus();

    if (!status.available) {
      return {
        name: this.displayName,
        configured: false,
        region: "local",
        warnings: status.warnings,
      };
    }

    return {
      name: this.displayName,
      configured: true,
      region: "local",
      account: `Docker ${status.version || ""}${status.composeVersion ? ` / Compose ${status.composeVersion}` : ""}`.trim(),
      warnings: status.warnings.length > 0 ? status.warnings : undefined,
    };
  }

  // ── Private: Artifact Generation ────────────────────────────

  private generateArtifacts(
    ctx: DockerDeploymentContext,
    resources: Resource[],
    runtime: string
  ): void {
    // Ensure output directory exists
    if (!existsSync(ctx.outputDir)) {
      mkdirSync(ctx.outputDir, { recursive: true });
    }

    // 1. Generate Dockerfile
    const dockerfile = generateDockerfile(ctx, resources, runtime);
    writeFileSync(join(ctx.outputDir, "Dockerfile"), dockerfile);

    // 2. Generate compose.yaml
    const composeFile = generateComposeFile(ctx, resources, runtime);
    const composeYaml = serializeComposeFile(composeFile);
    writeFileSync(join(ctx.outputDir, "compose.yaml"), composeYaml);

    // 3. Generate .env.example
    const envExample = generateEnvExample(ctx, resources);
    writeFileSync(join(ctx.outputDir, ".env.example"), envExample);

    // 4. Generate .env template (if not exists in project root)
    const envTemplatePath = join(ctx.outputDir, ".env");
    if (!existsSync(envTemplatePath)) {
      const envTemplate = generateEnvTemplate(ctx, resources, this.dockerConfig.bundleDependencies ?? false);
      writeFileSync(envTemplatePath, envTemplate);
    }

    // 5. Generate .dockerignore
    const dockerignore = generateDockerignore();
    writeFileSync(join(ctx.outputDir, ".dockerignore"), dockerignore);

    // 6. Copy .dockerignore to project root if not exists
    const projectDockerignore = join(ctx.projectRoot, ".dockerignore");
    if (!existsSync(projectDockerignore)) {
      writeFileSync(projectDockerignore, dockerignore);
    }
  }

  // ── Private: Helpers ────────────────────────────────────────

  private buildContext(appName: string, environment: string): DockerDeploymentContext {
    const stage = this.dockerConfig.stage || environment;
    const projectName = this.dockerConfig.projectName ||
      sanitizeDockerName(`${appName}-${stage}`);

    return {
      appName,
      environment: stage,
      dockerConfig: this.dockerConfig,
      projectName,
      outputDir: join(process.cwd(), ".nova", "docker"),
      projectRoot: process.cwd(),
      novaVersion: "2.1.9",
    };
  }

  private resolveImageTag(ctx: DockerDeploymentContext): string {
    const registry = this.dockerConfig.registry;

    if (registry?.tag) {
      return registry.tag;
    }

    switch (registry?.tagStrategy) {
      case "git-commit":
        return `git-${this.getGitCommit() || "unknown"}`;
      case "git-tag":
        return this.getGitTag() || "0.0.0";
      case "timestamp":
        return this.now().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      case "version":
      default:
        return (this.config as unknown as Record<string, unknown>)?.version as string || "1.0.0";
    }
  }

  private resolveImageName(ctx: DockerDeploymentContext): string {
    const registry = this.dockerConfig.registry;

    if (registry?.url && registry?.repository) {
      return `${registry.url}/${registry.repository}`;
    }

    if (registry?.repository) {
      return registry.repository;
    }

    return ctx.appName;
  }

  private resolveRegistryImage(ctx: DockerDeploymentContext, tag: string): string {
    const imageName = this.resolveImageName(ctx);
    return `${imageName}:${tag}`;
  }

  private extractServiceNames(resources: Resource[], ctx: DockerDeploymentContext): string[] {
    const names: string[] = [];

    for (const resource of resources) {
      switch (resource.type) {
        case "api":
          names.push(sanitizeDockerName(`${ctx.projectName}-${resource.name}`));
          break;
        case "function":
          names.push(sanitizeDockerName(`${ctx.projectName}-fn-${resource.name}`));
          break;
        case "queue":
          names.push(sanitizeDockerName(`${ctx.projectName}-worker-${resource.name}`));
          break;
        case "cron":
          names.push(sanitizeDockerName(`${ctx.projectName}-cron-${resource.name}`));
          break;
      }
    }

    return names;
  }

  private buildMetadata(
    ctx: DockerDeploymentContext,
    imageTag: string,
    imageRef: string
  ): DockerDeploymentMetadata {
    return {
      appName: ctx.appName,
      environment: ctx.environment,
      imageTag,
      imageRef,
      buildTimestamp: this.now().toISOString(),
      novaVersion: ctx.novaVersion,
      gitCommit: this.getGitCommit(),
      gitBranch: this.getGitBranch(),
      projectName: ctx.projectName,
    };
  }

  private saveDeploymentMetadata(
    ctx: DockerDeploymentContext,
    metadata: DockerDeploymentMetadata
  ): void {
    const metadataPath = join(ctx.outputDir, "deployment.json");
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private failResult(
    startTime: number,
    errors: Array<{ resource: string; error: string }>
  ): DeployResult {
    return {
      success: false,
      resources: [],
      durationMs: Date.now() - startTime,
      errors,
      outputs: {},
    };
  }

  private getGitCommit(): string | undefined {
    try {
      return execSync("git rev-parse --short HEAD", { encoding: "utf-8", timeout: 5000 }).trim();
    } catch {
      return undefined;
    }
  }

  private getGitBranch(): string | undefined {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8", timeout: 5000 }).trim();
    } catch {
      return undefined;
    }
  }

  private getGitTag(): string | undefined {
    try {
      return execSync("git describe --tags --abbrev=0", { encoding: "utf-8", timeout: 5000 }).trim();
    } catch {
      return undefined;
    }
  }
}

// ── Error Formatting ──────────────────────────────────────────

function formatError(
  provider: string,
  operation: string,
  error: unknown,
  remediation: string
): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    `Docker Provider Error\n` +
    `  Service:   ${provider}\n` +
    `  Operation: ${operation}\n` +
    `  Cause:     ${message}\n` +
    `  Action:    ${remediation}`
  );
}
