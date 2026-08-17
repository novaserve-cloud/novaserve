/**
 * GCP Cloud Functions Service
 *
 * Manages Cloud Functions (2nd gen) using @google-cloud/functions.
 */

import { CloudFunctionsServiceClient } from "@google-cloud/functions";
import { gcpRetry } from "../utils/retry.js";

export class GCPFunctionsService {
  private client: CloudFunctionsServiceClient;
  private projectId: string;
  private region: string;

  constructor(projectId: string, region: string) {
    this.projectId = projectId;
    this.region = region;
    this.client = new CloudFunctionsServiceClient();
  }

  /** Create a new Cloud Function */
  public async createFunction(functionName: string, environment: Record<string, string>): Promise<string> {
    const parent = `projects/${this.projectId}/locations/${this.region}`;
    const name = `${parent}/functions/${functionName}`;

    await gcpRetry(async () => {
      const [operation] = await this.client.createFunction({
        location: parent,
        function: {
          name,
          environmentVariables: environment,
          runtime: "nodejs20",
          entryPoint: "handler",
          // Note: Real deployment requires a source archive in Cloud Storage.
          // This is a minimal structural implementation for the provider scaffold.
          httpsTrigger: {},
        },
      });
      await operation.promise();
    });

    return name;
  }

  /** Delete a Cloud Function */
  public async deleteFunction(functionName: string): Promise<void> {
    const name = `projects/${this.projectId}/locations/${this.region}/functions/${functionName}`;

    try {
      await gcpRetry(async () => {
        const [operation] = await this.client.deleteFunction({ name });
        await operation.promise();
      });
    } catch (err: any) {
      if (err.code === 5 || err.message?.includes("NOT_FOUND")) {
        return;
      }
      throw err;
    }
  }

  /** Get live Function configuration for drift detection */
  public async getFunction(functionName: string): Promise<any | null> {
    const name = `projects/${this.projectId}/locations/${this.region}/functions/${functionName}`;
    try {
      const [response] = await gcpRetry(() => this.client.getFunction({ name }));
      return response;
    } catch (err: any) {
      if (err.code === 5 || err.message?.includes("NOT_FOUND")) {
        return null;
      }
      throw err;
    }
  }
}
