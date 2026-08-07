/**
 * Deployment Engine
 *
 * Orchestrates the full deployment lifecycle:
 * Config → Validate → Build → Plan → Deploy → Save State
 */

import type { NovaApp } from "novaserve-sdk";
import type { NovaProvider, DeploymentPlan, DeployResult } from "../types/provider.js";
import type { Resource, ResolvedResource } from "../types/resources.js";
import { toResource } from "../types/resources.js";
import { NovaEventBus } from "../types/events.js";
import { ConfigValidator } from "../config/validator.js";
import { DependencyGraph } from "../graph/dependency.js";
import { Bundler } from "../builder/bundler.js";
import { StateManager } from "./state.js";
import { InfrastructureDiff } from "./diff.js";

export interface DeployOptions {
  /** Target environment (default: "production") */
  environment?: string;
  /** Skip confirmation prompt */
  force?: boolean;
  /** Dry run — show plan without deploying */
  dryRun?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

export class DeploymentEngine {
  private provider: NovaProvider;
  private eventBus: NovaEventBus;
  private stateManager: StateManager;
  private validator: ConfigValidator;
  private graph: DependencyGraph;
  private projectRoot: string;

  constructor(
    provider: NovaProvider,
    projectRoot: string,
    eventBus?: NovaEventBus
  ) {
    this.provider = provider;
    this.projectRoot = projectRoot;
    this.eventBus = eventBus || new NovaEventBus();
    this.stateManager = new StateManager(projectRoot);
    this.validator = new ConfigValidator();
    this.graph = new DependencyGraph();
  }

  /**
   * Execute a full deployment.
   */
  async deploy(app: NovaApp, options: DeployOptions = {}): Promise<DeployResult> {
    const environment = options.environment || "production";
    const startTime = Date.now();

    try {
      // 1. Validate config
      await this.eventBus.emit("config:validated", { app: app.name });
      const validation = this.validator.validate(app);
      if (!validation.valid) {
        throw new Error(
          `[NovaServe] Configuration errors:\n${validation.errors.map((e) => `  ✗ ${e}`).join("\n")}`
        );
      }

      // 2. Convert SDK resources to core resources
      const resources: Resource[] = app.resources.map(toResource);

      // 3. Build dependency graph
      this.graph.build(resources);

      // 4. Initialize provider
      await this.provider.init(app.config);

      // 5. Validate with provider
      const providerValidation = await this.provider.validate(resources);
      if (!providerValidation.valid) {
        throw new Error(
          `[NovaServe] Provider validation errors:\n${providerValidation.errors
            .map((e) => `  ✗ [${e.resource}] ${e.message}`)
            .join("\n")}`
        );
      }

      // Execute plugin onInit & preBuild hooks
      const plugins = (app.config as any)?.plugins || [];
      for (const plugin of plugins) {
        if (plugin.onInit) await plugin.onInit(app);
        if (plugin.preBuild) await plugin.preBuild(app);
      }

      // 6. Build/bundle functions
      await this.eventBus.emit("build:start", { resourceCount: resources.length });
      const bundler = new Bundler(this.projectRoot);
      const handlers = this.extractHandlers(resources);

      const buildResultsMap = new Map<string, { size: number; durationMs: number }>();
      if (handlers.length > 0) {
        const results = await bundler.bundleAll(handlers);
        for (const [name, res] of results) {
          buildResultsMap.set(name, { size: res.size, durationMs: res.durationMs });
        }
      }
      await this.eventBus.emit("build:complete", { handlerCount: handlers.length });

      // Execute plugin postBuild hooks
      for (const plugin of plugins) {
        if (plugin.postBuild) await plugin.postBuild(app, buildResultsMap);
      }

      // 7. Get current state for diffing
      const currentState = this.stateManager.getResources(app.name, environment);

      // 8. Generate deployment plan
      await this.eventBus.emit("deploy:plan", { environment });
      const plan = await this.provider.plan(resources, currentState);

      if (options.dryRun) {
        return {
          success: true,
          resources: [],
          durationMs: Date.now() - startTime,
          errors: [],
          outputs: {},
        };
      }

      // Execute plugin preDeploy hooks
      for (const plugin of plugins) {
        if (plugin.preDeploy) await plugin.preDeploy(app);
      }

      // 9. Execute deployment
      await this.eventBus.emit("deploy:start", {
        actions: plan.summary,
        environment,
      });

      const result = await this.provider.deploy(plan);

      // 10. Save state
      if (result.success) {
        this.stateManager.saveDeployment(
          app.name,
          environment,
          this.provider.name,
          result.resources
        );
        await this.eventBus.emit("deploy:complete", {
          durationMs: Date.now() - startTime,
          outputs: result.outputs,
        });

        // Execute plugin postDeploy hooks
        for (const plugin of plugins) {
          if (plugin.postDeploy) await plugin.postDeploy(app, result);
        }
      } else {
        await this.eventBus.emit("deploy:error", {
          errors: result.errors,
        });
      }

      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      await this.eventBus.emit("deploy:error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Destroy all resources for an app.
   */
  async destroy(app: NovaApp, environment = "production"): Promise<void> {
    await this.eventBus.emit("destroy:start", { app: app.name, environment });

    const currentState = this.stateManager.getResources(app.name, environment);
    if (currentState.length === 0) {
      throw new Error(`[NovaServe] No deployed resources found for "${app.name}" in "${environment}"`);
    }

    await this.provider.init(app.config);
    await this.provider.destroy(currentState);

    this.stateManager.deleteDeployment(app.name, environment);
    await this.eventBus.emit("destroy:complete", { app: app.name });
  }

  /**
   * Get the event bus for subscribing to lifecycle events.
   */
  getEventBus(): NovaEventBus {
    return this.eventBus;
  }

  // ── Private ──────────────────────────────────────────

  /**
   * Extract handler file paths from resources.
   */
  private extractHandlers(
    resources: Resource[]
  ): Array<{ name: string; entryPoint: string }> {
    const handlers: Array<{ name: string; entryPoint: string }> = [];

    for (const resource of resources) {
      switch (resource.type) {
        case "api": {
          const routes = resource.config.routes as Record<string, string> | undefined;
          if (routes) {
            for (const [route, handler] of Object.entries(routes)) {
              const [method, path] = route.split(" ");
              const name = `api-${method?.toLowerCase()}-${path?.replace(/[/:]/g, "-").replace(/^-/, "")}`;
              const [filePath] = handler.split(".");
              handlers.push({ name, entryPoint: `${filePath}.ts` });
            }
          }
          break;
        }
        case "function": {
          const handler = resource.config.handler as string | undefined;
          if (handler) {
            const [filePath] = handler.split(".");
            handlers.push({
              name: `fn-${resource.name}`,
              entryPoint: `${filePath}.ts`,
            });
          }
          break;
        }
        case "queue": {
          const handler = resource.config.handler as string | undefined;
          if (handler) {
            const [filePath] = handler.split(".");
            handlers.push({
              name: `queue-${resource.name}`,
              entryPoint: `${filePath}.ts`,
            });
          }
          break;
        }
        case "cron": {
          const handler = resource.config.handler as string | undefined;
          if (handler) {
            const [filePath] = handler.split(".");
            handlers.push({
              name: `cron-${resource.name}`,
              entryPoint: `${filePath}.ts`,
            });
          }
          break;
        }
      }
    }

    return handlers;
  }
}
