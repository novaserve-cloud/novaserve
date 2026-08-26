/**
 * GCP Secret Manager Service
 *
 * Manages Secret Manager secrets.
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { gcpRetry } from "../utils/retry.js";

export class GCPSecretManagerService {
  private client: SecretManagerServiceClient;
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.client = new SecretManagerServiceClient();
  }

  /** Create a Secret */
  public async createSecret(secretId: string): Promise<string> {
    const parent = `projects/${this.projectId}`;
    
    await gcpRetry(async () => {
      try {
        await this.client.createSecret({
          parent,
          secretId,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });
      } catch (err: any) {
        if (err.code === 6) return; // Already exists
        throw err;
      }
    });

    return `${parent}/secrets/${secretId}`;
  }

  /** Delete a Secret */
  public async deleteSecret(secretId: string): Promise<void> {
    const name = `projects/${this.projectId}/secrets/${secretId}`;

    try {
      await gcpRetry(() => this.client.deleteSecret({ name }));
    } catch (err: any) {
      if (err.code === 5) return;
      throw err;
    }
  }
  /** Check if a secret exists (for drift detection — never reveals values) */
  public async secretExists(secretId: string): Promise<boolean> {
    const name = `projects/${this.projectId}/secrets/${secretId}`;
    try {
      await this.client.getSecret({ name });
      return true;
    } catch {
      return false;
    }
  }
}
