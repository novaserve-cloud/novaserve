/**
 * AWS S3 Service — Real S3 Bucket Operations
 *
 * Creates and deletes S3 buckets with encryption and public access blocking.
 */

import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  PutBucketEncryptionCommand,
  PutPublicAccessBlockCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export class S3Service {
  private client: S3Client;
  private region: string;

  constructor(region: string) {
    this.region = region;
    this.client = new S3Client({ region });
  }

  /** Create an S3 bucket with encryption and public access blocking */
  async createBucket(bucketName: string, appName: string): Promise<string> {
    const createParams: any = {
      Bucket: bucketName,
    };

    // LocationConstraint required for non-us-east-1 regions
    if (this.region !== "us-east-1") {
      createParams.CreateBucketConfiguration = {
        LocationConstraint: this.region,
      };
    }

    await this.client.send(new CreateBucketCommand(createParams));

    // Enable server-side encryption
    await this.client.send(
      new PutBucketEncryptionCommand({
        Bucket: bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256",
              },
              BucketKeyEnabled: true,
            },
          ],
        },
      })
    );

    // Block all public access
    await this.client.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      })
    );

    return `arn:aws:s3:::${bucketName}`;
  }

  /** Check if a bucket exists */
  async bucketExists(bucketName: string): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
      return true;
    } catch {
      return false;
    }
  }

  /** Delete an S3 bucket (empties it first) */
  async deleteBucket(bucketName: string): Promise<void> {
    try {
      // Empty the bucket first
      let continuationToken: string | undefined;
      do {
        const listResult = await this.client.send(
          new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: continuationToken,
          })
        );

        for (const obj of listResult.Contents || []) {
          await this.client.send(
            new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key! })
          );
        }

        continuationToken = listResult.IsTruncated
          ? listResult.NextContinuationToken
          : undefined;
      } while (continuationToken);

      // Delete the bucket
      await this.client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === "NoSuchBucket" || err.name === "NotFound")) {
        return; // Already deleted
      }
      throw err;
    }
  }
}
