/**
 * GCP Cloud Storage Service
 *
 * Manages Cloud Storage buckets using @google-cloud/storage.
 */

import { Storage } from "@google-cloud/storage";
import { gcpRetry } from "../utils/retry.js";

export class GCPStorageService {
  private storage: Storage;
  private projectId: string;
  private region: string;

  constructor(projectId: string, region: string) {
    this.projectId = projectId;
    this.region = region;
    this.storage = new Storage({ projectId });
  }

  /** Create a Cloud Storage Bucket */
  public async createBucket(bucketName: string): Promise<string> {
    const bucket = this.storage.bucket(bucketName);
    
    await gcpRetry(async () => {
      const [exists] = await bucket.exists();
      if (!exists) {
        await bucket.create({
          location: this.region,
          storageClass: "STANDARD",
        });
      }
    });

    return `gs://${bucketName}`;
  }

  /** Delete a Cloud Storage Bucket */
  public async deleteBucket(bucketName: string): Promise<void> {
    const bucket = this.storage.bucket(bucketName);
    
    try {
      await gcpRetry(async () => {
        const [exists] = await bucket.exists();
        if (exists) {
          // Must delete all files before deleting bucket
          await bucket.deleteFiles();
          await bucket.delete();
        }
      });
    } catch (err: any) {
      if (err.code === 404 || err.message?.includes("Not Found")) return;
      throw err;
    }
  }

  /** Check if a bucket exists (for drift detection) */
  public async bucketExists(bucketName: string): Promise<boolean> {
    const bucket = this.storage.bucket(bucketName);
    try {
      const [exists] = await gcpRetry(() => bucket.exists());
      return exists;
    } catch {
      return false;
    }
  }
}
