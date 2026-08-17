/**
 * Cloudflare Storage Service — R2 Buckets & KV Namespaces
 *
 * Manages Cloudflare R2 object storage buckets and Workers KV namespaces.
 */

import { CloudflareAuthManager } from "../utils/auth.js";
import { cloudflareRetry } from "../utils/retry.js";

export class CloudflareStorageService {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  /** Create an R2 Object Storage bucket */
  public async createR2Bucket(bucketName: string): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: bucketName }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes("already exists") || res.status === 409) return;
        throw new Error(`[Cloudflare API Error] Create R2 bucket "${bucketName}" failed (${res.status}): ${errText}`);
      }
    });

    return `r2://${this.accountId}/${bucketName}`;
  }

  /** Check if an R2 bucket exists */
  public async r2BucketExists(bucketName: string): Promise<boolean> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${bucketName}`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    try {
      const res = await fetch(url, { method: "GET", headers });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Create a KV Namespace */
  public async createKVNamespace(title: string): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    let namespaceId = "";

    await cloudflareRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[Cloudflare API Error] Create KV namespace "${title}" failed (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as { result?: { id?: string } };
      namespaceId = json.result?.id || "";
    });

    return namespaceId;
  }

  /** Delete a KV Namespace */
  public async deleteKVNamespace(namespaceId: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    try {
      await cloudflareRetry(async () => {
        const res = await fetch(url, { method: "DELETE", headers });
        if (res.status === 404) return;
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`[Cloudflare API Error] Delete KV namespace "${namespaceId}" failed (${res.status}): ${errText}`);
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("404")) return;
      throw err;
    }
  }

  /** Delete an R2 Object Storage bucket */
  public async deleteR2Bucket(bucketName: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${bucketName}`;
    const headers = CloudflareAuthManager.getHeaders(this.apiToken);

    try {
      await cloudflareRetry(async () => {
        const res = await fetch(url, { method: "DELETE", headers });
        if (res.status === 404) return;
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`[Cloudflare API Error] Delete R2 bucket "${bucketName}" failed (${res.status}): ${errText}`);
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("404")) return;
      throw err;
    }
  }
}
