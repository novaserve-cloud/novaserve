/**
 * Cloudflare D1 Service
 *
 * Manages Cloudflare D1 databases.
 */

import { CloudflareAuthManager } from "../utils/auth.js";
import { cloudflareRetry } from "../utils/retry.js";

export class CloudflareD1Service {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  /** Create a D1 Database */
  public async createDatabase(name: string): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);
    
    let databaseId = "";

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes("already exists") || res.status === 409) return;
        throw new Error(`[Cloudflare API Error] Create D1 database "${name}" failed (${res.status}): ${errText}`);
      }
      
      const json = (await res.json()) as { result?: { uuid?: string } };
      databaseId = json.result?.uuid || "";
    });

    return databaseId;
  }

  /** Delete a D1 Database */
  public async deleteDatabase(databaseId: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${databaseId}`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    try {
      await cloudflareRetry(async () => {
        const res = await fetch(url, { method: "DELETE", headers });
        if (res.status === 404) return;
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`[Cloudflare API Error] Delete D1 database "${databaseId}" failed (${res.status}): ${errText}`);
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("404")) return;
      throw err;
    }
  }
}
