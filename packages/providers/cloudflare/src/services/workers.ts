/**
 * Cloudflare Workers Service — Real REST API v4 Integration
 *
 * Manages Cloudflare Worker scripts, bindings (R2, KV, Queues), and HTTP routes.
 */

import { CloudflareAuthManager } from "../utils/auth.js";
import { cloudflareRetry } from "../utils/retry.js";

export interface WorkerBinding {
  type: "r2_bucket" | "kv_namespace" | "queue" | "secret_text";
  name: string;
  namespace_id?: string;
  bucket_name?: string;
  queue_name?: string;
  text?: string;
}

export interface DeployWorkerOptions {
  scriptName: string;
  scriptContent: string;
  bindings?: WorkerBinding[];
  environment?: string;
}

export class CloudflareWorkersService {
  private apiToken: string;
  private accountId: string;
  private zoneId?: string;

  constructor(apiToken: string, accountId: string, zoneId?: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.zoneId = zoneId;
  }

  /** Upload or update a Cloudflare Worker script with bindings */
  public async uploadWorker(options: DeployWorkerOptions): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${options.scriptName}`;

    const metadata = {
      main_module: "index.js",
      bindings: options.bindings || [],
      compatibility_date: "2024-01-01",
      compatibility_flags: ["nodejs_compat"],
    };

    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
      "metadata.json"
    );

    formData.append(
      "index.js",
      new Blob([options.scriptContent], { type: "application/javascript+module" }),
      "index.js"
    );

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[Cloudflare API Error] Upload worker "${options.scriptName}" failed (${res.status}): ${errText}`);
      }
    });

    return `https://${options.scriptName}.${this.accountId}.workers.dev`;
  }

  /** Attach a Worker script route to a Cloudflare Zone */
  public async createWorkerRoute(pattern: string, scriptName: string): Promise<string> {
    if (!this.zoneId) return "";

    const url = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/workers/routes`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    let routeId = "";

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pattern,
          script: scriptName,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes("already exists")) return;
        throw new Error(`[Cloudflare API Error] Create route "${pattern}" failed (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as { result?: { id?: string } };
      routeId = json.result?.id || "";
    });

    return routeId;
  }

  /** Fetch live Worker script status */
  public async getWorker(scriptName: string): Promise<{ name: string; modified_on?: string } | null> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${scriptName}`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    try {
      const res = await fetch(url, { method: "GET", headers });
      if (res.status === 404) return null;
      if (!res.ok) return null;

      const json = (await res.json()) as { result?: { id?: string; modified_on?: string } };
      return json.result ? { name: scriptName, modified_on: json.result.modified_on } : null;
    } catch {
      return null;
    }
  }

  /** Delete a Cloudflare Worker script */
  public async deleteWorker(scriptName: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${scriptName}`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    try {
      await cloudflareRetry(async () => {
        const res = await fetch(url, { method: "DELETE", headers });
        if (res.status === 404) return;
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`[Cloudflare API Error] Delete worker "${scriptName}" failed (${res.status}): ${errText}`);
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("404")) return;
      throw err;
    }
  }

  /** Attach cron triggers to a Worker script */
  public async updateCronTriggers(scriptName: string, crons: { cron: string }[]): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${scriptName}/schedules`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(crons),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[Cloudflare API Error] Update cron triggers for "${scriptName}" failed (${res.status}): ${errText}`);
      }
    });
  }
}
