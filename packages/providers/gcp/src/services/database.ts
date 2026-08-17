/**
 * GCP Database Service
 *
 * Maps "postgres" and "mysql" engines to Cloud SQL instances.
 */

import { sqladmin, sqladmin_v1 } from "@googleapis/sqladmin";
import { GCPCredentials } from "../utils/auth.js";
import { gcpRetry } from "../utils/retry.js";

export class GCPDatabaseService {
  private projectId: string;
  private region: string;
  private sqlAdmin: sqladmin_v1.Sqladmin;

  constructor(projectId: string, region: string, authClient: any) {
    this.projectId = projectId;
    this.region = region;
    this.sqlAdmin = sqladmin({ version: "v1", auth: authClient });
  }

  /**
   * Create a Cloud SQL instance.
   * Rejects MongoDB and DynamoDB as they are not supported by Cloud SQL.
   */
  public async createDatabase(instanceName: string, engine: string, config: any): Promise<string> {
    let databaseVersion = "POSTGRES_15";
    
    if (engine === "mysql") {
      databaseVersion = "MYSQL_8_0";
    } else if (engine === "mongodb" || engine === "dynamodb") {
      throw new Error(`Engine '${engine}' is not supported by GCP Cloud SQL.`);
    } else if (engine !== "postgres") {
      console.warn(`[GCP] Unknown engine '${engine}', defaulting to Postgres 15.`);
    }

    await gcpRetry(async () => {
      try {
        await this.sqlAdmin.instances.insert({
          project: this.projectId,
          requestBody: {
            name: instanceName,
            region: this.region,
            databaseVersion,
            settings: {
              tier: config?.tier || "db-f1-micro",
            },
          },
        });
      } catch (err: any) {
        if (err.code === 409) {
          // Already exists
          return;
        }
        throw err;
      }
    });

    return `gcp:cloudsql:${this.projectId}:${this.region}:${instanceName}`;
  }

  /** Delete a Cloud SQL instance */
  public async deleteDatabase(instanceName: string): Promise<void> {
    try {
      await gcpRetry(() =>
        this.sqlAdmin.instances.delete({
          project: this.projectId,
          instance: instanceName,
        })
      );
    } catch (err: any) {
      if (err.code === 404) return;
      throw err;
    }
  }

  /** Check if instance exists */
  public async databaseExists(instanceName: string): Promise<boolean> {
    try {
      await gcpRetry(() =>
        this.sqlAdmin.instances.get({
          project: this.projectId,
          instance: instanceName,
        })
      );
      return true;
    } catch {
      return false;
    }
  }
}
