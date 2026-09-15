/**
 * Cloudflare Auth Manager — Credential Resolution, Validation & Masking
 *
 * Resolves Cloudflare API tokens and Account IDs from environment variables
 * or explicit configuration. Validates credentials before deployment operations.
 * Never exposes tokens in logs, errors, or output.
 */

import { CloudflareAuthenticationError } from "../errors.js";

export interface CloudflareCredentials {
  apiToken: string;
  accountId: string;
  zoneId?: string;
  /** Auth method used */
  method: "api-token" | "global-key" | "none";
}

export class CloudflareAuthManager {
  /**
   * Resolve Cloudflare credentials from explicit config or environment variables.
   *
   * Resolution order:
   * 1. Explicit config values (apiToken, accountId)
   * 2. CLOUDFLARE_API_TOKEN / CF_API_TOKEN
   * 3. CLOUDFLARE_ACCOUNT_ID / CF_ACCOUNT_ID
   * 4. CLOUDFLARE_ZONE_ID / CF_ZONE_ID (optional)
   */
  public static getCredentials(
    overrideConfig?: Record<string, unknown>
  ): CloudflareCredentials {
    const apiToken =
      (overrideConfig?.apiToken as string) ||
      process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CF_API_TOKEN ||
      "";

    const accountId =
      (overrideConfig?.accountId as string) ||
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      process.env.CF_ACCOUNT_ID ||
      "";

    const zoneId =
      (overrideConfig?.zoneId as string) ||
      process.env.CLOUDFLARE_ZONE_ID ||
      process.env.CF_ZONE_ID;

    const method: CloudflareCredentials["method"] =
      apiToken ? "api-token" : "none";

    return { apiToken, accountId, zoneId, method };
  }

  /**
   * Generate standard HTTP headers for Cloudflare REST API v4.
   */
  public static getHeaders(apiToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": "NovaServe-Cloudflare-Provider/3.0.0",
    };
  }

  /**
   * Check if credentials are fully configured.
   */
  public static isConfigured(creds: CloudflareCredentials): boolean {
    return Boolean(creds.apiToken && creds.accountId);
  }

  /**
   * Validate that credentials are present and throw actionable errors if not.
   */
  public static requireCredentials(
    creds: CloudflareCredentials,
    operation: string
  ): void {
    if (!creds.apiToken) {
      throw new CloudflareAuthenticationError({
        message:
          "Cloudflare API token is not configured. " +
          "Set CLOUDFLARE_API_TOKEN environment variable or configure apiToken in nova.config.",
        operation,
      });
    }

    if (!creds.accountId) {
      throw new CloudflareAuthenticationError({
        message:
          "Cloudflare Account ID is not configured. " +
          "Set CLOUDFLARE_ACCOUNT_ID environment variable or configure accountId in nova.config.",
        operation,
      });
    }
  }

  /**
   * Validate credentials by calling Cloudflare's token verification endpoint.
   * Returns account details on success, throws on failure.
   */
  public static async validateCredentials(
    apiToken: string
  ): Promise<{ id: string; status: string }> {
    const url = "https://api.cloudflare.com/client/v4/user/tokens/verify";

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          "User-Agent": "NovaServe-Cloudflare-Provider/3.0.0",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new CloudflareAuthenticationError({
            message:
              "Cloudflare API token is invalid or expired. " +
              "Generate a new token at https://dash.cloudflare.com/profile/api-tokens",
            operation: "validateCredentials",
          });
        }
        throw new CloudflareAuthenticationError({
          message: `Cloudflare credential validation failed with status ${res.status}`,
          operation: "validateCredentials",
        });
      }

      const body = (await res.json()) as {
        success: boolean;
        result?: { id: string; status: string };
      };

      if (!body.success || !body.result) {
        throw new CloudflareAuthenticationError({
          message: "Cloudflare API token verification returned unsuccessful response",
          operation: "validateCredentials",
        });
      }

      if (body.result.status !== "active") {
        throw new CloudflareAuthenticationError({
          message: `Cloudflare API token status is "${body.result.status}" (expected "active")`,
          operation: "validateCredentials",
        });
      }

      return body.result;
    } catch (err) {
      if (err instanceof CloudflareAuthenticationError) {
        throw err;
      }
      throw new CloudflareAuthenticationError({
        message: `Failed to validate Cloudflare credentials: ${err instanceof Error ? err.message : String(err)}`,
        operation: "validateCredentials",
        cause: err instanceof Error ? err : undefined,
      });
    }
  }

  /**
   * Mask an API token for safe display in logs and error messages.
   * Shows only the last 4 characters.
   */
  public static maskToken(token: string): string {
    if (!token || token.length < 8) {
      return "***";
    }
    return `***${token.slice(-4)}`;
  }

  /**
   * Mask all sensitive fields in a credentials object for safe logging.
   */
  public static maskCredentials(creds: CloudflareCredentials): Record<string, string> {
    return {
      apiToken: CloudflareAuthManager.maskToken(creds.apiToken),
      accountId: creds.accountId ? `${creds.accountId.slice(0, 4)}***` : "not set",
      zoneId: creds.zoneId ? `${creds.zoneId.slice(0, 4)}***` : "not set",
      method: creds.method,
    };
  }
}
