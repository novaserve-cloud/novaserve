/**
 * AWS S3 Service — Real S3 Bucket Operations
 *
 * Creates and deletes S3 buckets with encryption, public access blocking,
 * ownership tagging, removal policy safeguards, and exponential backoff retry handling.
 */

import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  PutBucketEncryptionCommand,
  PutPublicAccessBlockCommand,
  PutBucketTaggingCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { awsRetry } from "../utils/retry.js";

export class S3Service {
  private client: S3Client;
  private region: string;

  constructor(region: string) {
    this.region = region;
    this.client = new S3Client({ region });
  }

  /** Create an S3 bucket with encryption and public access blocking */
  async createBucket(
    bucketName: string,
    appName: string,
    environment = "production"
  ): Promise<string> {
    const createParams: any = { Bucket: bucketName };

    if (this.region !== "us-east-1") {
      createParams.CreateBucketConfiguration = { LocationConstraint: this.region };
    }

    await awsRetry(() => this.client.send(new CreateBucketCommand(createParams)));

    // Enable server-side encryption
    await awsRetry(() =>
      this.client.send(
        new PutBucketEncryptionCommand({
          Bucket: bucketName,
          ServerSideEncryptionConfiguration: {
            Rules: [
              {
                ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
                BucketKeyEnabled: true,
              },
            ],
          },
        })
      )
    );

    // Block all public access
    await awsRetry(() =>
      this.client.send(
        new PutPublicAccessBlockCommand({
          Bucket: bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        })
      )
    );

    // Apply ownership tags
    await awsRetry(() =>
      this.client.send(
        new PutBucketTaggingCommand({
          Bucket: bucketName,
          Tagging: {
            TagSet: [
              { Key: "novaserve:managed", Value: "true" },
              { Key: "novaserve:application", Value: appName },
              { Key: "novaserve:environment", Value: environment },
              { Key: "novaserve:resource", Value: bucketName },
              { Key: "novaserve:version", Value: "1.0.0" },
            ],
          },
        })
      )
    );

    return `arn:aws:s3:::${bucketName}`;
  }

  /** Check if a bucket exists */
  async bucketExists(bucketName: string): Promise<boolean> {
    try {
      await awsRetry(() => this.client.send(new HeadBucketCommand({ Bucket: bucketName })));
      return true;
    } catch {
      return false;
    }
  }

  /** Delete an S3 bucket (empties it first if destruction is allowed) */
  async deleteBucket(bucketName: string, force = false, removalPolicy = "destroy"): Promise<void> {
    if (removalPolicy === "retain" && !force) {
      console.warn(`[NovaServe Safety] Retaining S3 bucket "${bucketName}" due to removalPolicy="retain".`);
      return;
    }

    try {
      // Empty the bucket first
      let continuationToken: string | undefined;
      do {
        const listResult = await awsRetry(() =>
          this.client.send(
            new ListObjectsV2Command({
              Bucket: bucketName,
              ContinuationToken: continuationToken,
            })
          )
        );

        for (const obj of listResult.Contents || []) {
          await awsRetry(() =>
            this.client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key! }))
          );
        }

        continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
      } while (continuationToken);

      // Delete the bucket
      await awsRetry(() => this.client.send(new DeleteBucketCommand({ Bucket: bucketName })));
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === "NoSuchBucket" || err.name === "NotFound")) {
        return; // Already deleted
      }
      throw err;
    }
  }
}
