/**
 * GCP API Gateway Service
 *
 * Manages API Gateway for API resources.
 */

import { ApiGatewayServiceClient } from "@google-cloud/api-gateway";
import { gcpRetry } from "../utils/retry.js";

export class GCPApiGatewayService {
  private client: ApiGatewayServiceClient;
  private projectId: string;
  private region: string;

  constructor(projectId: string, region: string) {
    this.projectId = projectId;
    this.region = region;
    this.client = new ApiGatewayServiceClient();
  }

  /** Create API Gateway */
  public async createApi(apiId: string): Promise<string> {
    const parent = `projects/${this.projectId}/locations/global`;
    const name = `${parent}/apis/${apiId}`;

    await gcpRetry(async () => {
      try {
        const [operation] = await this.client.createApi({
          parent,
          apiId,
          api: {
            displayName: apiId,
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

  /** Delete API Gateway */
  public async deleteApi(apiId: string): Promise<void> {
    const name = `projects/${this.projectId}/locations/global/apis/${apiId}`;

    try {
      await gcpRetry(async () => {
        const [operation] = await this.client.deleteApi({ name });
        await operation.promise();
      });
    } catch (err: any) {
      if (err.code === 5) return;
      throw err;
    }
  }
  /** Check if an API exists (for drift detection) */
  public async apiExists(apiId: string): Promise<boolean> {
    const name = `projects/${this.projectId}/locations/global/apis/${apiId}`;
    try {
      await this.client.getApi({ name });
      return true;
    } catch {
      return false;
    }
  }
}
