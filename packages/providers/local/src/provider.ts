/**
 * Local Provider
 *
 * Implements the NovaProvider interface for local development.
 * Uses Hono for the API server and in-memory emulators for
 * storage, queues, and cron.
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
} from "@novaserve/core";
import type { Resource, ResolvedResource } from "@novaserve/core";
import type { NovaAppConfig } from "@novaserve/sdk";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { build } from "esbuild";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";

interface LocalProviderOptions {
  port?: number;
}

interface DevServerOptions {
  hotReload?: boolean;
  projectRoot?: string;
}

export class LocalProvider implements NovaProvider {
  readonly name = "local";
  readonly displayName = "Local Development";

  private port: number;
  private config?: NovaAppConfig;
  private server?: ReturnType<typeof serve>;
  private logs: LogEntry[] = [];

  constructor(options: LocalProviderOptions) {
    this.port = options.port || 3000;
  }

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    // Local provider accepts everything
    return { valid: true, errors: [], warnings: [] };
  }

  async plan(
    resources: Resource[],
    currentState: ResolvedResource[]
  ): Promise<DeploymentPlan> {
    const actions: DeploymentPlanAction[] = resources.map((r) => ({
      action: "create" as const,
      resource: r,
      reason: "Local emulation",
      dependsOn: r.dependencies,
    }));

    return {
      appName: this.config?.name || "unknown",
      provider: this.name,
      environment: "local",
      actions,
      summary: {
        create: actions.length,
        update: 0,
        delete: 0,
        skip: 0,
      },
    };
  }

  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    const startTime = Date.now();

    const resources: ResolvedResource[] = plan.actions.map((action) => ({
      ...action.resource,
      id: `local-${action.resource.type}-${action.resource.name}`,
      configHash: createHash("sha256")
        .update(JSON.stringify(action.resource.config))
        .digest("hex"),
      status: "deployed" as const,
      outputs: {},
    }));

    return {
      success: true,
      resources,
      durationMs: Date.now() - startTime,
      errors: [],
      outputs: {
        url: `http://localhost:${this.port}`,
      },
    };
  }

  async destroy(_resources: ResolvedResource[]): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }

  async *getLogs(
    _resource: string,
    _options?: LogOptions
  ): AsyncIterable<LogEntry> {
    for (const entry of this.logs) {
      yield entry;
    }
  }

  async invoke(functionName: string, payload: unknown): Promise<InvokeResult> {
    return {
      statusCode: 200,
      body: { message: `Function ${functionName} invoked locally` },
      headers: { "Content-Type": "application/json" },
      durationMs: 0,
      coldStart: false,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      name: this.displayName,
      configured: true,
      region: "local",
      account: "localhost",
    };
  }

  // ── Dev Server ──────────────────────────────────────

  /**
   * Start the local development server.
   */
  async startDevServer(
    resources: Resource[],
    options: DevServerOptions = {}
  ): Promise<void> {
    const app = new Hono();
    const projectRoot = options.projectRoot || process.cwd();

    // Register API routes
    for (const resource of resources) {
      if (resource.type === "api") {
        const routes = resource.config.routes as Record<string, string> | undefined;
        if (!routes) continue;

        for (const [route, handlerPath] of Object.entries(routes)) {
          const [method, path] = route.split(" ");
          if (!method || !path) continue;

          const normalizedPath = path.replace(/:(\w+)/g, ":$1");

          // Register the route with dynamic handler loading
          const registerRoute = (
            honoApp: Hono,
            httpMethod: string,
            routePath: string,
            handler: string
          ) => {
            const routeHandler = async (c: any) => {
              try {
                const handlerFn = await this.loadHandler(projectRoot, handler);
                if (!handlerFn) {
                  return c.json({ error: `Handler not found: ${handler}` }, 404);
                }

                // Create a simplified context
                const event = {
                  httpMethod: httpMethod.toUpperCase(),
                  path: routePath,
                  pathParameters: c.req.param(),
                  queryStringParameters: Object.fromEntries(
                    new URL(c.req.url).searchParams
                  ),
                  headers: Object.fromEntries(c.req.raw.headers),
                  body: httpMethod !== "GET" ? await c.req.text() : null,
                };

                const result = await handlerFn(event);

                if (result && typeof result === "object" && "statusCode" in result) {
                  const headers: Record<string, string> = (result as any).headers || {};
                  return c.json(
                    JSON.parse((result as any).body || "{}"),
                    (result as any).statusCode,
                    headers
                  );
                }

                return c.json(result || { ok: true });
              } catch (error) {
                console.error(`[NovaServe] Error in ${handler}:`, error);
                return c.json(
                  {
                    error: error instanceof Error ? error.message : "Internal Server Error",
                  },
                  500
                );
              }
            };

            switch (httpMethod.toUpperCase()) {
              case "GET": honoApp.get(routePath, routeHandler); break;
              case "POST": honoApp.post(routePath, routeHandler); break;
              case "PUT": honoApp.put(routePath, routeHandler); break;
              case "PATCH": honoApp.patch(routePath, routeHandler); break;
              case "DELETE": honoApp.delete(routePath, routeHandler); break;
              default: honoApp.all(routePath, routeHandler);
            }
          };

          registerRoute(app, method, normalizedPath, handlerPath);
        }
      }
    }

    // Health check endpoint
    app.get("/__nova/health", (c) =>
      c.json({
        status: "healthy",
        provider: "local",
        resources: resources.length,
        uptime: process.uptime(),
      })
    );

    // Start the server
    this.server = serve({
      fetch: app.fetch,
      port: this.port,
    });

    // Setup hot reload
    if (options.hotReload) {
      this.setupHotReload(projectRoot);
    }
  }

  // ── Private ──────────────────────────────────────────

  /**
   * Dynamically load a handler function from the project.
   */
  private async loadHandler(
    projectRoot: string,
    handlerPath: string
  ): Promise<((event: unknown) => Promise<unknown>) | null> {
    // Parse handler path: "src/handlers/users.list" → file: src/handlers/users, export: list
    const parts = handlerPath.split(".");
    const exportName = parts.pop() || "handler";
    const filePath = parts.join(".");

    // Try different extensions
    const extensions = [".ts", ".js", ".mts", ".mjs"];
    let sourcePath: string | null = null;

    for (const ext of extensions) {
      const candidate = join(projectRoot, filePath + ext);
      if (existsSync(candidate)) {
        sourcePath = candidate;
        break;
      }
    }

    if (!sourcePath) {
      return null;
    }

    try {
      // Transpile with esbuild
      const tmpDir = join(projectRoot, ".nova", "tmp", "handlers");
      await mkdir(tmpDir, { recursive: true });

      const hash = createHash("md5").update(sourcePath + Date.now()).digest("hex").slice(0, 8);
      const outFile = join(tmpDir, `${hash}.mjs`);

      await build({
        entryPoints: [sourcePath],
        outfile: outFile,
        bundle: true,
        format: "esm",
        platform: "node",
        target: "node20",
        write: true,
        logLevel: "silent",
      });

      const fileUrl = pathToFileURL(outFile).href;
      const mod = await import(fileUrl);

      // Cleanup temp file
      unlink(outFile).catch(() => {});

      const handler = mod[exportName] || mod.default?.[exportName] || mod.default;

      if (typeof handler !== "function") {
        console.error(`[NovaServe] Export "${exportName}" is not a function in ${filePath}`);
        return null;
      }

      return handler;
    } catch (error) {
      console.error(`[NovaServe] Failed to load handler ${handlerPath}:`, error);
      return null;
    }
  }

  /**
   * Setup file watcher for hot reload.
   */
  private async setupHotReload(projectRoot: string): Promise<void> {
    try {
      const { watch } = await import("chokidar");

      const watcher = watch(join(projectRoot, "src"), {
        ignoreInitial: true,
        ignored: /node_modules|\.nova|dist/,
      });

      watcher.on("change", (path) => {
        console.log(`\n  ↻ File changed: ${path.replace(projectRoot + "/", "")}`);
        console.log(`  ↻ Hot reload active — next request will use updated code\n`);
      });

      watcher.on("add", (path) => {
        console.log(`\n  + File added: ${path.replace(projectRoot + "/", "")}\n`);
      });

      watcher.on("unlink", (path) => {
        console.log(`\n  - File removed: ${path.replace(projectRoot + "/", "")}\n`);
      });
    } catch {
      console.warn("[NovaServe] Hot reload unavailable (chokidar not found)");
    }
  }
}
