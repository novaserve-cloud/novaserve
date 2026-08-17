/**
 * GCP Cloud Scheduler Service
 *
 * Manages Cloud Scheduler jobs for Cron resources.
 */

import { CloudSchedulerClient } from "@google-cloud/scheduler";
import { gcpRetry } from "../utils/retry.js";

export class GCPSchedulerService {
  private client: CloudSchedulerClient;
  private projectId: string;
  private region: string;

  constructor(projectId: string, region: string) {
    this.projectId = projectId;
    this.region = region;
    this.client = new CloudSchedulerClient();
  }

  /** Create a Scheduler Job */
  public async createJob(jobName: string, schedule: string, targetUri: string): Promise<string> {
    const parent = `projects/${this.projectId}/locations/${this.region}`;
    const name = `${parent}/jobs/${jobName}`;

    await gcpRetry(async () => {
      try {
        await this.client.createJob({
          parent,
          job: {
            name,
            schedule,
            httpTarget: {
              uri: targetUri,
              httpMethod: "POST",
            },
          },
        });
      } catch (err: any) {
        if (err.code === 6) {
          // Already exists, maybe update it? 
          // For simplicity in this scaffold, we ignore if it exists.
          return;
        }
        throw err;
      }
    });

    return name;
  }

  /** Delete a Scheduler Job */
  public async deleteJob(jobName: string): Promise<void> {
    const name = `projects/${this.projectId}/locations/${this.region}/jobs/${jobName}`;

    try {
      await gcpRetry(() => this.client.deleteJob({ name }));
    } catch (err: any) {
      if (err.code === 5) return;
      throw err;
    }
  }
}
