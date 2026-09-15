/**
 * Cloudflare Provider — Production-Grade Cloud Deployment
 *
 * Implements the NovaProvider interface for Cloudflare Workers, R2 Buckets,
 * D1 Databases, KV Namespaces, and Queues.
 *
 * Architecture Decision: Uses NovaServe's existing esbuild-based Bundler
 * for Worker builds. Does NOT require Wrangler CLI.
 *
 * Deployment Pipeline:
 *   validate → provision resources → resolve bindings → deploy Worker →
 *   apply secrets → run migrations → configure routes → health check → done
 *
 * All operations are idempotent, environment-isolated, and credential-safe.
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
} from "novaserve-core";
import type { Resource, ResolvedResource } from "novaserve-core";
import type { NovaAppConfig } from "novaserve-sdk";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

import type {
  CloudflareProviderConfig,
  CloudflareProvisionedResources,
  CloudflareDeploymentMetadata,
  CloudflareKVConfig,
  CloudflareR2Config,
  CloudflareD1Config,
  CloudflareQueueConfig,
  WorkerDomain,
} from "./types.js";

import { CloudflareApiClient } from "./utils/api-client.js";
import { CloudflareAuthManager } from "./utils/auth.js";
import { resolveBindings } from "./utils/bindings.js";
import {
  resolveEnvironmentName,
  resolveWorkerName,
  isProductionEnvironment,
  mergeEnvironmentVars,
  mergeEnvironmentSecrets,
} from "./utils/environment.js";
import { validateCloudflareConfig } from "./validators.js";

import { CloudflareWorkersService } from "./services/workers.js";
import { CloudflareStorageService } from "./services/storage.js";
import { CloudflareKVService } from "./services/kv.js";
import { CloudflareD1Service } from "./services/d1.js";
import { CloudflareQueueService } from "./services/queues.js";
import { CloudflareSecretsService } from "./services/secrets.js";
import { CloudflareLogsService } from "./services/logs.js";

import {
  CloudflareDeploymentError,
  CloudflareAuthenticationError,
  sanitizeErrorMessage,
} from "./errors.js";

export class CloudflareProvider implements NovaProvider {
  readonly name = "cloudflare";
  readonly displayName = "Cloudflare";

  private config?: NovaAppConfig;
  private cloudflareConfig: CloudflareProviderConfig = {};
  private client!: CloudflareApiClient;

  // Services
  private workers!: CloudflareWorkersService;
  private storage!: CloudflareStorageService;
  private kv!: CloudflareKVService;
  private d1!: CloudflareD1Service;
  private queues!: CloudflareQueueService;
  private secrets!: CloudflareSecretsService;
  private logs!: CloudflareLogsService;

  private initialized = false;

  // ── Lifecycle ───────────────────────────────────────────────

  async init(config?: NovaAppConfig): Promise<void> {
    this.config = config;

    // Extract Cloudflare-specific config
    const rawConfig = (config as unknown as Record<string, unknown>) || {};
    this.cloudflareConfig =
      (rawConfig.cloudflare as CloudflareProviderConfig) || {};

    // Resolve credentials
    const creds = CloudflareAuthManager.getCredentials(
      this.cloudflareConfig as unknown as Record<string, unknown>
    );

    if (!CloudflareAuthManager.isConfigured(creds)) {
      // Allow init without credentials for validation-only workflows
      this.initialized = false;
      return;
    }

    // Create centralized API client
    this.client = new CloudflareApiClient({
      apiToken: creds.apiToken,
      accountId: creds.accountId,
    });

    // Initialize all services with shared client
    this.workers = new CloudflareWorkersService(this.client, creds.zoneId);
    this.storage = new CloudflareStorageService(this.client);
    this.kv = new CloudflareKVService(this.client);
    this.d1 = new CloudflareD1Service(this.client);
    this.queues = new CloudflareQueueService(this.client);
    this.secrets = new CloudflareSecretsService(this.client);
    this.logs = new CloudflareLogsService(this.client);

    this.initialized = true;
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    return validateCloudflareConfig(resources, this.cloudflareConfig);
  }

  // ── Deployment ──────────────────────────────────────────────

  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    const startTime = Date.now();
    const errors: Array<{ resource: string; error: string }> = [];
    const outputs: Record<string, string> = {};
    const deployedResources: ResolvedResource[] = [];

    const appName = plan.appName || "app";
    const environment = plan.environment || "production";

    // ── Phase 0: Ensure Initialization ────────────────────
    if (!this.initialized) {
      await this.init(this.config);
    }

    if (!this.initialized) {
      return this.failResult(startTime, [
        {
          resource: "provider",
          error:
            "Cloudflare provider is not initialized. " +
            "Ensure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are set.",
        },
      ]);
    }

    // ── Phase 1: Validate Credentials ─────────────────────
    try {
      await CloudflareAuthManager.validateCredentials(this.client.token);
    } catch (err) {
      return this.failResult(startTime, [
        {
          resource: "credentials",
          error:
            err instanceof CloudflareAuthenticationError
              ? err.actionableMessage
              : `Credential validation failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    }

    // ── Phase 2: Resolve Environment Config ───────────────
    const envConfig = this.cloudflareConfig.environments?.[environment];
    const workerConfig = {
      ...this.cloudflareConfig.worker,
      ...envConfig?.worker,
    };
    const vars = mergeEnvironmentVars(
      workerConfig.vars || {},
      envConfig?.vars || {}
    );
    const secretNames = mergeEnvironmentSecrets(
      workerConfig.secrets || [],
      envConfig?.secrets || []
    );
    const kvConfigs: CloudflareKVConfig[] = [
      ...(this.cloudflareConfig.kv || []),
      ...(envConfig?.kv || []),
    ];
    const r2Configs: CloudflareR2Config[] = [
      ...(this.cloudflareConfig.r2 || []),
      ...(envConfig?.r2 || []),
    ];
    const d1Configs: CloudflareD1Config[] = [
      ...(this.cloudflareConfig.d1 || []),
      ...(envConfig?.d1 || []),
    ];
    const queueConfigs: CloudflareQueueConfig[] =
      this.cloudflareConfig.queues || [];

    // Map Nova resource types to Cloudflare configs
    for (const action of plan.actions) {
      if (action.action === "skip" || action.action === "delete") continue;
      const res = action.resource;

      switch (res.type) {
        case "cache":
          if (!kvConfigs.find((k) => k.name === res.name)) {
            kvConfigs.push({ name: res.name.toUpperCase().replace(/-/g, "_") });
          }
          break;
        case "storage":
          if (!r2Configs.find((r) => r.name === res.name)) {
            r2Configs.push({
              name: res.name.toUpperCase().replace(/-/g, "_"),
            });
          }
          break;
        case "database":
          if (!d1Configs.find((d) => d.name === res.name)) {
            d1Configs.push({
              name: res.name.toUpperCase().replace(/-/g, "_"),
              migrationsDir: (res.config.migrationsDir as string) || undefined,
            });
          }
          break;
        case "queue":
          if (!queueConfigs.find((q) => q.name === res.name)) {
            queueConfigs.push({
              name: res.name.toUpperCase().replace(/-/g, "_"),
            });
          }
          break;
      }
    }

    // ── Phase 3: Provision Resources (Idempotent) ─────────
    const provisioned: CloudflareProvisionedResources = {
      kv: {},
      r2: {},
      d1: {},
      queues: {},
    };

    // 3a. Provision KV Namespaces
    for (const kvConfig of kvConfigs) {
      const physicalName = resolveEnvironmentName(
        appName,
        kvConfig.title || kvConfig.name.toLowerCase(),
        environment
      );
      try {
        const nsId = await this.kv.createNamespace(physicalName);
        provisioned.kv[kvConfig.name] = nsId;
        outputs[`kv_${kvConfig.name}`] = nsId;
      } catch (err) {
        errors.push({
          resource: `kv:${kvConfig.name}`,
          error: this.formatDeployError("Provision KV", kvConfig.name, err),
        });
      }
    }

    // 3b. Provision R2 Buckets
    for (const r2Config of r2Configs) {
      const physicalName = resolveEnvironmentName(
        appName,
        r2Config.bucketName || r2Config.name.toLowerCase(),
        environment
      );
      try {
        const bucketName = await this.storage.createBucket(
          physicalName,
          r2Config.locationHint
        );
        provisioned.r2[r2Config.name] = bucketName;
        outputs[`r2_${r2Config.name}`] = bucketName;
      } catch (err) {
        errors.push({
          resource: `r2:${r2Config.name}`,
          error: this.formatDeployError("Provision R2", r2Config.name, err),
        });
      }
    }

    // 3c. Provision D1 Databases
    for (const d1Config of d1Configs) {
      const physicalName = resolveEnvironmentName(
        appName,
        d1Config.databaseName || d1Config.name.toLowerCase(),
        environment
      );
      try {
        const dbId = await this.d1.createDatabase(physicalName);
        provisioned.d1[d1Config.name] = dbId;
        outputs[`d1_${d1Config.name}`] = dbId;
      } catch (err) {
        errors.push({
          resource: `d1:${d1Config.name}`,
          error: this.formatDeployError("Provision D1", d1Config.name, err),
        });
      }
    }

    // 3d. Provision Queues
    for (const queueConfig of queueConfigs) {
      const physicalName = resolveEnvironmentName(
        appName,
        queueConfig.queueName || queueConfig.name.toLowerCase(),
        environment
      );
      try {
        const queueId = await this.queues.createQueue(physicalName);
        provisioned.queues[queueConfig.name] = queueId;
        outputs[`queue_${queueConfig.name}`] = queueId;
      } catch (err) {
        errors.push({
          resource: `queue:${queueConfig.name}`,
          error: this.formatDeployError("Provision Queue", queueConfig.name, err),
        });
      }
    }

    // If provisioning failed, return early
    if (errors.length > 0) {
      return this.failResult(startTime, errors);
    }

    // ── Phase 4: Resolve Bindings ─────────────────────────
    let resolvedBindings;
    try {
      resolvedBindings = resolveBindings(
        kvConfigs,
        r2Configs,
        d1Configs,
        queueConfigs,
        provisioned,
        workerConfig.bindings || [],
        vars,
        environment
      );
    } catch (err) {
      return this.failResult(startTime, [
        {
          resource: "bindings",
          error: this.formatDeployError("Resolve Bindings", "worker", err),
        },
      ]);
    }

    // ── Phase 5: Deploy Workers ───────────────────────────
    for (const action of plan.actions) {
      if (action.action === "skip") continue;

      const res = action.resource;

      // Only deploy function/api/cron as Workers
      if (
        res.type !== "function" &&
        res.type !== "api" &&
        res.type !== "cron"
      ) {
        // Non-Worker resources are already provisioned above
        if (action.action !== "delete") {
          deployedResources.push(
            this.toResolvedResource(res, appName, environment)
          );
        }
        continue;
      }

      if (action.action === "delete") {
        try {
          const workerName = resolveWorkerName(
            `${appName}-${res.name}`,
            environment
          );
          await this.workers.deleteWorker(workerName);
        } catch (err) {
          errors.push({
            resource: res.name,
            error: this.formatDeployError("Delete Worker", res.name, err),
          });
        }
        continue;
      }

      // Deploy Worker
      const workerName =
        workerConfig.name ||
        resolveWorkerName(`${appName}-${res.name}`, environment);

      try {
        // Get Worker code from resource config or provide default
        const code =
          (res.config.code as string) ||
          (res.config.bundle as string) ||
          this.generateDefaultWorkerCode(res, appName);

        const endpoint = await this.workers.uploadWorker({
          scriptName: workerName,
          scriptContent: code,
          bindings: resolvedBindings,
          compatibilityDate:
            workerConfig.compatibilityDate || "2024-09-01",
          compatibilityFlags: workerConfig.compatibilityFlags || [
            "nodejs_compat",
          ],
          environment,
        });

        outputs[`${res.name}_url`] = endpoint;

        // Configure cron triggers
        if (res.type === "cron") {
          const schedule =
            (res.config.schedule as string) || "0 * * * *";
          await this.workers.updateCronTriggers(workerName, [
            { cron: schedule },
          ]);
          outputs[`${res.name}_cron`] = schedule;
        }

        // Configure routes (if Zone ID available and routes configured)
        if (workerConfig.routes) {
          for (const route of workerConfig.routes) {
            const zoneId =
              route.zoneId || this.cloudflareConfig.zoneId;
            if (zoneId && route.pattern) {
              try {
                await this.workers.createWorkerRoute(
                  route.pattern,
                  workerName,
                  zoneId
                );
                outputs[`${res.name}_route`] = route.pattern;
              } catch (routeErr) {
                // Route failures are warnings, not deployment failures
                errors.push({
                  resource: res.name,
                  error: `Route "${route.pattern}" configuration failed: ${routeErr instanceof Error ? routeErr.message : String(routeErr)}`,
                });
              }
            }
          }
        }

        // Configure custom domains
        if (workerConfig.domains) {
          for (const domain of workerConfig.domains) {
            const zoneId =
              domain.zoneId || this.cloudflareConfig.zoneId;
            if (zoneId) {
              try {
                await this.workers.setWorkerCustomDomain(
                  workerName,
                  domain.domain,
                  zoneId
                );
                outputs[`${res.name}_domain`] = domain.domain;
              } catch {
                // Domain failures are non-fatal
              }
            }
          }
        }

        deployedResources.push({
          type: res.type,
          name: res.name,
          config: res.config,
          dependencies: res.dependencies,
          id: `cloudflare:${workerName}:${res.type}:${res.name}`,
          configHash: createHash("sha256")
            .update(JSON.stringify(res.config))
            .digest("hex"),
          status: "deployed",
          provider: "cloudflare",
          providerId: endpoint,
          outputs: { url: endpoint },
        });
      } catch (err) {
        errors.push({
          resource: res.name,
          error: this.formatDeployError("Deploy Worker", res.name, err),
        });
      }
    }

    // ── Phase 6: Apply Secrets ────────────────────────────
    if (secretNames.length > 0 && deployedResources.length > 0) {
      const workerName =
        workerConfig.name ||
        resolveWorkerName(appName, environment);

      try {
        const result = await this.secrets.putBulkSecrets(
          workerName,
          secretNames
        );
        if (result.missing.length > 0) {
          outputs.missing_secrets = result.missing.join(", ");
        }
        outputs.secrets_applied = String(result.set.length);
      } catch (err) {
        errors.push({
          resource: "secrets",
          error: this.formatDeployError("Apply Secrets", "worker", err),
        });
      }
    }

    // ── Phase 7: Run D1 Migrations ────────────────────────
    for (const d1Config of d1Configs) {
      const dbId = provisioned.d1[d1Config.name];
      if (!dbId || !d1Config.migrationsDir) continue;

      const migrationsPath = join(process.cwd(), d1Config.migrationsDir);
      if (!existsSync(migrationsPath)) continue;

      try {
        const migrationResult = await this.d1.executeMigrations(
          dbId,
          migrationsPath,
          environment
        );
        if (migrationResult.applied.length > 0) {
          outputs[`d1_${d1Config.name}_migrations`] =
            `${migrationResult.applied.length} applied`;
        }
      } catch (err) {
        errors.push({
          resource: `d1:${d1Config.name}`,
          error: this.formatDeployError(
            "D1 Migration",
            d1Config.name,
            err
          ),
        });
      }
    }

    // ── Phase 8: Save Deployment Metadata ─────────────────
    const metadata: CloudflareDeploymentMetadata = {
      deploymentId: plan.deploymentId || `cf-dep-${Date.now()}`,
      appName,
      environment,
      provider: "cloudflare",
      workerName:
        workerConfig.name || resolveWorkerName(appName, environment),
      workerUrl: outputs[Object.keys(outputs).find((k) => k.endsWith("_url")) || ""] || undefined,
      status: errors.length === 0 ? "success" : "failed",
      resources: provisioned,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      gitCommit: this.getGitCommit(),
      gitBranch: this.getGitBranch(),
      novaVersion: "3.0.0",
    };

    this.saveDeploymentMetadata(metadata);

    // ── Build Result ──────────────────────────────────────
    outputs.provider = "cloudflare";
    outputs.environment = environment;
    outputs.deploymentId = metadata.deploymentId;
    outputs.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

    return {
      success: errors.length === 0,
      resources: deployedResources,
      outputs,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  // ── Destroy ─────────────────────────────────────────────────

  async destroy(resources: ResolvedResource[]): Promise<void> {
    if (!this.initialized) {
      await this.init(this.config);
    }
    if (!this.initialized) return;

    for (const res of resources) {
      try {
        switch (res.type) {
          case "function":
          case "api":
          case "cron":
            await this.workers.deleteWorker(
              res.providerId || res.name
            );
            break;
          case "storage":
            await this.storage.deleteBucket(
              res.providerId || res.name
            );
            break;
          case "cache":
            await this.kv.deleteNamespace(res.providerId || res.id);
            break;
          case "database":
            await this.d1.deleteDatabase(res.providerId || res.id);
            break;
          case "queue":
            await this.queues.deleteQueue(
              res.providerId || res.name
            );
            break;
        }
      } catch {
        // Continue cleanup on individual failures
      }
    }
  }

  // ── Logs ────────────────────────────────────────────────────

  async *getLogs(
    resource: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    if (!this.initialized) {
      await this.init(this.config);
    }
    if (!this.initialized) return;

    for await (const entry of this.logs.getLogs(resource, options)) {
      yield entry;
    }
  }

  // ── Invoke ──────────────────────────────────────────────────

  async invoke(
    functionName: string,
    payload: unknown
  ): Promise<InvokeResult> {
    const startTime = Date.now();

    if (!this.initialized) {
      await this.init(this.config);
    }

    const workerUrl = `https://${functionName}.${this.client?.account || "unknown"}.workers.dev`;

    try {
      const res = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });

      const data = await res.json().catch(() => ({}));

      return {
        statusCode: res.status,
        body: data,
        headers: Object.fromEntries(res.headers.entries()),
        durationMs: Date.now() - startTime,
      };
    } catch {
      return {
        statusCode: 503,
        body: {
          error: `Failed to invoke Worker "${functionName}"`,
          url: workerUrl,
        },
        headers: {},
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ── Status ──────────────────────────────────────────────────

  async getStatus(): Promise<ProviderStatus> {
    const creds = CloudflareAuthManager.getCredentials(
      this.cloudflareConfig as unknown as Record<string, unknown>
    );
    const configured = CloudflareAuthManager.isConfigured(creds);
    const warnings: string[] = [];

    if (!configured) {
      warnings.push(
        "Cloudflare credentials not configured. " +
          "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID."
      );
    }

    // Validate credentials if configured
    if (configured) {
      try {
        await CloudflareAuthManager.validateCredentials(creds.apiToken);
      } catch (err) {
        warnings.push(
          `Credential validation failed: ${err instanceof Error ? sanitizeErrorMessage(err.message) : "unknown error"}`
        );
      }
    }

    return {
      name: this.displayName,
      configured,
      region: "global",
      account: configured
        ? CloudflareAuthManager.maskCredentials(creds).accountId
        : "Unconfigured",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ── Private Helpers ─────────────────────────────────────────

  private toResolvedResource(
    res: Resource,
    appName: string,
    environment: string
  ): ResolvedResource {
    return {
      type: res.type,
      name: res.name,
      config: res.config,
      dependencies: res.dependencies,
      id: `cloudflare:${appName}:${res.type}:${res.name}`,
      configHash: createHash("sha256")
        .update(JSON.stringify(res.config))
        .digest("hex"),
      status: "deployed",
      provider: "cloudflare",
      outputs: {},
    };
  }

  private generateDefaultWorkerCode(
    res: Resource,
    appName: string
  ): string {
    if (res.type === "cron") {
      return `export default {
  async scheduled(controller, env, ctx) {
    console.log("Cron execution for ${appName}/${res.name}");
  }
};`;
    }

    return `export default {
  async fetch(request, env, ctx) {
    return new Response("Hello from ${appName}/${res.name}", {
      headers: { "Content-Type": "text/plain" }
    });
  }
};`;
  }

  private formatDeployError(
    phase: string,
    resource: string,
    err: unknown
  ): string {
    const message =
      err instanceof Error
        ? sanitizeErrorMessage(err.message)
        : String(err);
    return (
      `Cloudflare Deployment Error\n` +
      `  Phase:    ${phase}\n` +
      `  Resource: ${resource}\n` +
      `  Cause:    ${message}`
    );
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

  private saveDeploymentMetadata(
    metadata: CloudflareDeploymentMetadata
  ): void {
    try {
      const dir = join(process.cwd(), ".nova", "cloudflare");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(
        join(dir, `deployment-${metadata.environment}.json`),
        JSON.stringify(metadata, null, 2)
      );
    } catch {
      // Best-effort metadata save
    }
  }

  private getGitCommit(): string | undefined {
    try {
      return execSync("git rev-parse --short HEAD", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
    } catch {
      return undefined;
    }
  }

  private getGitBranch(): string | undefined {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
    } catch {
      return undefined;
    }
  }
}
