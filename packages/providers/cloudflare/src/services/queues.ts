/**
 * Cloudflare Queues Service — Real REST API v4 Integration
 *
 * Manages Cloudflare Queues for asynchronous event processing.
 */

import { CloudflareAuthManager } from "../utils/auth.js";
import { cloudflareRetry } from "../utils/retry.js";

export class CloudflareQueueService {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  /** Create a Cloudflare Queue */
  public async createQueue(queueName: string): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/queues`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    let queueId = "";

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ queue_name: queueName }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes("already exists") || res.status === 409) return;
        throw new Error(`[Cloudflare API Error] Create queue "${queueName}" failed (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as { result?: { queue_id?: string; queue_name?: string } };
      queueId = json.result?.queue_id || queueName;
    });

    return queueId || queueName;
  }

  /** Delete a Cloudflare Queue */
  public async deleteQueue(queueName: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/queues/${queueName}`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    try {
      await cloudflareRetry(async () => {
        const res = await fetch(url, { method: "DELETE", headers });
        if (res.status === 404) return;
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`[Cloudflare API Error] Delete queue "${queueName}" failed (${res.status}): ${errText}`);
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("404")) return;
      throw err;
    }
  }
}
