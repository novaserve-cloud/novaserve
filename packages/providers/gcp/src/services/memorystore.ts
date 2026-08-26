/**
 * GCP Memorystore Service
 *
 * Manages Memorystore for Redis instances for Cache resources.
 */

import { CloudRedisClient } from "@google-cloud/redis";
import { gcpRetry } from "../utils/retry.js";

export class GCPMemorystoreService {
  private client: CloudRedisClient;
  private projectId: string;
  private region: string;

  constructor(projectId: string, region: string) {
    this.projectId = projectId;
    this.region = region;
    this.client = new CloudRedisClient();
  }

  /** Create a Redis instance */
  public async createInstance(instanceName: string): Promise<string> {
    const parent = `projects/${this.projectId}/locations/${this.region}`;
    const name = `${parent}/instances/${instanceName}`;

    await gcpRetry(async () => {
      try {
        const [operation] = await this.client.createInstance({
          parent,
          instanceId: instanceName,
          instance: {
            name,
            tier: "BASIC",
            memorySizeGb: 1,
          },
        });
        await operation.promise();
      } catch (err: any) {
        if (err.code === 6) return; // Already exists
        throw err;
      }
    });

    return name;
  }

  /** Delete a Redis instance */
  public async deleteInstance(instanceName: string): Promise<void> {
    const name = `projects/${this.projectId}/locations/${this.region}/instances/${instanceName}`;

    try {
      await gcpRetry(async () => {
        const [operation] = await this.client.deleteInstance({ name });
        await operation.promise();
      });
    } catch (err: any) {
      if (err.code === 5) return;
      throw err;
    }
  }
  /** Check if a Redis instance exists (for drift detection) */
  public async instanceExists(instanceName: string): Promise<boolean> {
    const name = `projects/${this.projectId}/locations/${this.region}/instances/${instanceName}`;
    try {
      await this.client.getInstance({ name });
      return true;
    } catch {
      return false;
    }
  }
}
