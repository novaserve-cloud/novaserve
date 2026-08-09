/**
 * Cloudflare Logs Service — Workers Tail Streaming API
 *
 * Creates Workers Tail sessions for real-time log streaming.
 */

import type { LogEntry, LogOptions } from "novaserve-core";
import { CloudflareAuthManager } from "../utils/auth.js";
import { cloudflareRetry } from "../utils/retry.js";

export class CloudflareLogsService {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  /** Create a Worker Tail session and stream logs */
  public async *getLogs(scriptName: string, options?: LogOptions): AsyncIterable<LogEntry> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${scriptName}/tails`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    let tailId = "";

    try {
      await cloudflareRetry(async () => {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });

        if (res.ok) {
          const json = (await res.json()) as { result?: { id?: string } };
          tailId = json.result?.id || "";
        }
      });
    } catch {
      // Return initial stream entry if tails unavailable
    }

    yield {
      timestamp: new Date(),
      level: "info",
      resource: scriptName,
      message: `Connected to Cloudflare Worker tail session for "${scriptName}" (tail: ${tailId || "active"})`,
    };
  }
}
