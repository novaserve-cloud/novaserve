/**
 * Cloudflare Secrets Service — Workers Secret Management
 *
 * Manages secret environment variables for Cloudflare Worker scripts.
 * Secret values are resolved from process.env at deploy time and
 * are never stored in state, logs, or deployment plans.
 */

import type { CloudflareApiClient } from "../utils/api-client.js";

export interface CloudflareSecretInfo {
  name: string;
  type: string;
}

export class CloudflareSecretsService {
  private client: CloudflareApiClient;

  constructor(client: CloudflareApiClient) {
    this.client = client;
  }

  /**
   * Set a secret on a Worker script.
   *
   * Idempotent: PUT creates or replaces the secret.
   * The secret value is never logged.
   */
  public async putSecret(
    scriptName: string,
    secretName: string,
    secretValue: string
  ): Promise<void> {
    await this.client.put(
      `/workers/scripts/${scriptName}/secrets`,
      "putSecret",
      {
        name: secretName,
        text: secretValue,
        type: "secret_text",
      },
      { resource: `${scriptName}/${secretName}` }
    );
  }

  /**
   * Set multiple secrets on a Worker script in sequence.
   *
   * Values are resolved from process.env. Missing environment
   * variables result in a warning but don't fail the deployment.
   *
   * @returns List of secrets that were set and list of missing secrets
   */
  public async putBulkSecrets(
    scriptName: string,
    secretNames: string[]
  ): Promise<{ set: string[]; missing: string[] }> {
    const set: string[] = [];
    const missing: string[] = [];

    for (const name of secretNames) {
      const value = process.env[name];
      if (!value) {
        missing.push(name);
        continue;
      }

      await this.putSecret(scriptName, name, value);
      set.push(name);
    }

    return { set, missing };
  }

  /**
   * List secret names on a Worker script.
   *
   * Note: Cloudflare never returns secret values, only names.
   */
  public async listSecrets(
    scriptName: string
  ): Promise<CloudflareSecretInfo[]> {
    try {
      const result = await this.client.get<CloudflareSecretInfo[]>(
        `/workers/scripts/${scriptName}/secrets`,
        "listSecrets",
        { resource: scriptName }
      );
      return result || [];
    } catch {
      return [];
    }
  }

  /**
   * Delete a secret from a Worker script.
   * Silently succeeds if the secret doesn't exist.
   */
  public async deleteSecret(
    scriptName: string,
    secretName: string
  ): Promise<void> {
    try {
      await this.client.delete(
        `/workers/scripts/${scriptName}/secrets/${secretName}`,
        "deleteSecret",
        { resource: `${scriptName}/${secretName}` }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return;
      }
      throw err;
    }
  }
}
