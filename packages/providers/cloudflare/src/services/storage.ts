/**
 * Cloudflare R2 Storage Service — R2 Object Storage Buckets
 *
 * Manages Cloudflare R2 buckets with full CRUD lifecycle.
 * Idempotent: checks for existing buckets before creating.
 */

import type { CloudflareApiClient } from "../utils/api-client.js";
import type { CloudflareR2Bucket } from "../types.js";

export class CloudflareStorageService {
  private client: CloudflareApiClient;

  constructor(client: CloudflareApiClient) {
    this.client = client;
  }

  /**
   * Create an R2 bucket.
   *
   * Idempotent: checks if a bucket with the same name already exists.
   * If it does, returns the existing bucket name.
   *
   * @returns Bucket name
   */
  public async createBucket(
    bucketName: string,
    locationHint?: string
  ): Promise<string> {
    // Check if bucket already exists
    const exists = await this.bucketExists(bucketName);
    if (exists) {
      return bucketName;
    }

    const body: Record<string, unknown> = { name: bucketName };
    if (locationHint) {
      body.locationHint = locationHint;
    }

    await this.client.post("/r2/buckets", "createR2Bucket", body, {
      resource: bucketName,
    });

    return bucketName;
  }

  /**
   * Get R2 bucket metadata.
   */
  public async getBucket(
    bucketName: string
  ): Promise<CloudflareR2Bucket | null> {
    try {
      return await this.client.get<CloudflareR2Bucket>(
        `/r2/buckets/${bucketName}`,
        "getR2Bucket",
        { resource: bucketName }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return null;
      }
      throw err;
    }
  }

  /**
   * List all R2 buckets in the account.
   */
  public async listBuckets(): Promise<CloudflareR2Bucket[]> {
    const result = await this.client.get<{ buckets: CloudflareR2Bucket[] }>(
      "/r2/buckets",
      "listR2Buckets"
    );
    return result?.buckets || [];
  }

  /**
   * Delete an R2 bucket.
   * Silently succeeds if the bucket doesn't exist.
   *
   * Note: Bucket must be empty before deletion.
   */
  public async deleteBucket(bucketName: string): Promise<void> {
    try {
      await this.client.delete(
        `/r2/buckets/${bucketName}`,
        "deleteR2Bucket",
        { resource: bucketName }
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

  /**
   * Check if an R2 bucket exists.
   */
  public async bucketExists(bucketName: string): Promise<boolean> {
    const bucket = await this.getBucket(bucketName);
    return bucket !== null;
  }
}
