/**
 * Cloudflare Secrets Service — Workers Secret Management
 *
 * Uploads secret environment variables directly to Cloudflare Workers scripts
 * without storing secret values in state, logs, or deployment plans.
 */

import { CloudflareAuthManager } from "../utils/auth.js";
import { cloudflareRetry } from "../utils/retry.js";

export class CloudflareSecretsService {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  /** Upload a secret variable to a Cloudflare Worker script */
  public async putSecret(scriptName: string, secretName: string, secretValue: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: secretName,
          text: secretValue,
          type: "secret_text",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[Cloudflare API Error] Put secret "${secretName}" on "${scriptName}" failed (${res.status}): ${errText}`);
      }
    });
  }
}
