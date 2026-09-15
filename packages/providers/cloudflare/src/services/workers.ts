/**
 * Cloudflare Workers Service — Complete Worker Lifecycle
 *
 * Manages Cloudflare Worker scripts including create, update, rollback,
 * delete, status, versions, routes, custom domains, and cron triggers.
 * Uses the centralized API client for all operations.
 */

import type { CloudflareApiClient } from "../utils/api-client.js";
import type {
  CloudflareResolvedBinding,
  CloudflareWorkerMetadata,
  CloudflareWorkerDeployment,
} from "../types.js";
import { bindingsToApiFormat } from "../utils/bindings.js";

export interface DeployWorkerOptions {
  /** Worker script name */
  scriptName: string;
  /** Bundled JavaScript source code */
  scriptContent: string;
  /** Worker bindings (KV, R2, D1, env vars, secrets) */
  bindings?: CloudflareResolvedBinding[];
  /** Compatibility date (default: "2024-09-01") */
  compatibilityDate?: string;
  /** Compatibility flags (default: ["nodejs_compat"]) */
  compatibilityFlags?: string[];
  /** Deployment environment label */
  environment?: string;
  /** Main module name (default: "index.js") */
  mainModule?: string;
}

export class CloudflareWorkersService {
  private client: CloudflareApiClient;
  private zoneId?: string;

  constructor(client: CloudflareApiClient, zoneId?: string) {
    this.client = client;
    this.zoneId = zoneId;
  }

  /**
   * Upload or update a Cloudflare Worker script with bindings.
   *
   * This operation is idempotent — PUT creates or replaces the Worker.
   * Returns the Worker URL (workers.dev).
   */
  public async uploadWorker(options: DeployWorkerOptions): Promise<string> {
    const metadata = {
      main_module: options.mainModule || "index.js",
      bindings: options.bindings
        ? bindingsToApiFormat(options.bindings)
        : [],
      compatibility_date: options.compatibilityDate || "2024-09-01",
      compatibility_flags: options.compatibilityFlags || ["nodejs_compat"],
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
      "metadata.json"
    );
    formData.append(
      "index.js",
      new Blob([options.scriptContent], {
        type: "application/javascript+module",
      }),
      "index.js"
    );

    await this.client.uploadForm(
      `/workers/scripts/${options.scriptName}`,
      "uploadWorker",
      formData,
      {
        resource: options.scriptName,
        environment: options.environment,
        timeoutMs: 60000,
      }
    );

    return `https://${options.scriptName}.${this.client.account}.workers.dev`;
  }

  /**
   * Get Worker script metadata.
   * Returns null if the Worker doesn't exist.
   */
  public async getWorker(
    scriptName: string
  ): Promise<CloudflareWorkerMetadata | null> {
    try {
      return await this.client.get<CloudflareWorkerMetadata>(
        `/workers/scripts/${scriptName}`,
        "getWorker",
        { resource: scriptName }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === "CloudflareResourceNotFoundError" ||
          err.message.includes("404"))
      ) {
        return null;
      }
      throw err;
    }
  }

  /**
   * List all Worker scripts in the account.
   */
  public async listWorkers(): Promise<CloudflareWorkerMetadata[]> {
    const result = await this.client.get<CloudflareWorkerMetadata[]>(
      "/workers/scripts",
      "listWorkers"
    );
    return result || [];
  }

  /**
   * Delete a Worker script.
   * Silently succeeds if the Worker doesn't exist.
   */
  public async deleteWorker(scriptName: string): Promise<void> {
    try {
      await this.client.delete(
        `/workers/scripts/${scriptName}`,
        "deleteWorker",
        { resource: scriptName }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === "CloudflareResourceNotFoundError" ||
          err.message.includes("404"))
      ) {
        return; // Already deleted
      }
      throw err;
    }
  }

  /**
   * Get Worker deployment versions for rollback support.
   */
  public async getWorkerDeployments(
    scriptName: string
  ): Promise<CloudflareWorkerDeployment[]> {
    try {
      const result = await this.client.get<{ deployments: CloudflareWorkerDeployment[] }>(
        `/workers/scripts/${scriptName}/deployments`,
        "getWorkerDeployments",
        { resource: scriptName }
      );
      return result?.deployments || [];
    } catch {
      return [];
    }
  }

  /**
   * Rollback a Worker to a specific version.
   *
   * Uses Cloudflare's Deployments API to route traffic
   * back to a previous version.
   */
  public async rollbackWorker(
    scriptName: string,
    versionId: string
  ): Promise<void> {
    await this.client.post(
      `/workers/scripts/${scriptName}/deployments`,
      "rollbackWorker",
      {
        strategy: "percentage",
        versions: [{ version_id: versionId, percentage: 100 }],
      },
      { resource: scriptName }
    );
  }

  /**
   * Attach cron triggers to a Worker script.
   */
  public async updateCronTriggers(
    scriptName: string,
    crons: { cron: string }[]
  ): Promise<void> {
    await this.client.put(
      `/workers/scripts/${scriptName}/schedules`,
      "updateCronTriggers",
      crons,
      { resource: scriptName }
    );
  }

  /**
   * Create a Worker route on a Cloudflare Zone.
   * Requires Zone ID.
   * Idempotent: silently succeeds if route already exists.
   */
  public async createWorkerRoute(
    pattern: string,
    scriptName: string,
    zoneId?: string
  ): Promise<string> {
    const zone = zoneId || this.zoneId;
    if (!zone) return "";

    try {
      const result = await this.client.requestUnscoped<{ id: string }>(
        "POST",
        `/zones/${zone}/workers/routes`,
        "createWorkerRoute",
        { pattern, script: scriptName },
        { resource: scriptName }
      );
      return result?.id || "";
    } catch (err: unknown) {
      // Silently handle "already exists"
      if (
        err instanceof Error &&
        (err.name === "CloudflareResourceExistsError" ||
          err.message.includes("already exists"))
      ) {
        return "";
      }
      throw err;
    }
  }

  /**
   * Attach a custom domain to a Worker.
   * Requires Zone ID.
   */
  public async setWorkerCustomDomain(
    scriptName: string,
    hostname: string,
    zoneId?: string
  ): Promise<void> {
    const zone = zoneId || this.zoneId;
    if (!zone) return;

    try {
      await this.client.put(
        `/workers/domains`,
        "setWorkerCustomDomain",
        {
          zone_id: zone,
          hostname,
          service: scriptName,
          environment: "production",
        },
        { resource: scriptName }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceExistsError"
      ) {
        return;
      }
      throw err;
    }
  }

  /**
   * Check if a Worker is actively deployed and serving requests.
   */
  public async getWorkerStatus(
    scriptName: string
  ): Promise<{ exists: boolean; modifiedOn?: string }> {
    const worker = await this.getWorker(scriptName);
    if (!worker) {
      return { exists: false };
    }
    return { exists: true, modifiedOn: worker.modified_on };
  }
}
