/**
 * Cloudflare Auth Manager — Token & Account Resolution
 *
 * Resolves Cloudflare API tokens, Account ID, and Zone ID from environment variables
 * or explicit configuration. Provides standard REST headers for API v4 calls.
 */

export interface CloudflareCredentials {
  apiToken: string;
  accountId: string;
  zoneId?: string;
}

export class CloudflareAuthManager {
  /** Resolve Cloudflare credentials from environment or config */
  public static getCredentials(overrideConfig?: Record<string, unknown>): CloudflareCredentials {
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

    return { apiToken, accountId, zoneId };
  }

  /** Generate standard HTTP headers for Cloudflare REST API v4 */
  public static getHeaders(apiToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": "NovaServe-Cloudflare-Provider/2.0.0",
    };
  }

  /** Check if credentials are present */
  public static isConfigured(creds: CloudflareCredentials): boolean {
    return Boolean(creds.apiToken && creds.accountId);
  }
}
