/**
 * GCP Live State Inspector
 *
 * Inspects actual deployed live infrastructure resources across GCP.
 */

import { GCPFunctionsService } from "./services/functions.js";
import { GCPStorageService } from "./services/storage.js";
import { GCPDatabaseService } from "./services/database.js";

export interface ObservedGCPResource {
  resourceId: string;
  type: string;
  name: string;
  status: "deployed" | "missing" | "drifted";
  liveConfig: Record<string, unknown>;
  lastObservedIso: string;
}

export class GCPLiveStateInspector {
  private functions: GCPFunctionsService;
  private storage: GCPStorageService;
  private database: GCPDatabaseService;
  private appName: string;

  constructor(projectId: string, region: string, authClient: any, appName: string = "unknown") {
    this.appName = appName;
    this.functions = new GCPFunctionsService(projectId, region);
    this.storage = new GCPStorageService(projectId, region);
    this.database = new GCPDatabaseService(projectId, region, authClient);
  }

  /** Inspect live GCP state for Nova IR resources */
  public async inspectResources(
    resources: Array<{ id: string; type: string; name: string; config: Record<string, unknown> }>
  ): Promise<Record<string, ObservedGCPResource>> {
    const observed: Record<string, ObservedGCPResource> = {};

    for (const res of resources) {
      const physicalName = `${this.appName}-${res.name}`;
      const liveConfig: Record<string, unknown> = {};
      let isMissing = false;

      try {
        switch (res.type) {
          case "function": {
            const state = await this.functions.getFunction(physicalName);
            if (!state) {
              isMissing = true;
            } else {
              liveConfig.state = state.state;
            }
            break;
          }
          case "storage": {
            const exists = await this.storage.bucketExists(physicalName);
            if (!exists) {
              isMissing = true;
            }
            break;
          }
          case "database": {
            const exists = await this.database.databaseExists(physicalName);
            if (!exists) {
              isMissing = true;
            }
            break;
          }
          default: {
            // Unimplemented inspectors for other resources fallback to assuming deployed if no error
            isMissing = false;
            break;
          }
        }

        observed[res.id] = {
          resourceId: res.id,
          type: res.type,
          name: res.name,
          status: isMissing ? "missing" : "deployed",
          liveConfig,
          lastObservedIso: new Date().toISOString(),
        };
      } catch {
        observed[res.id] = {
          resourceId: res.id,
          type: res.type,
          name: res.name,
          status: "missing",
          liveConfig: {},
          lastObservedIso: new Date().toISOString(),
        };
      }
    }

    return observed;
  }
}
