/**
 * Deployment Journal & Failure Recovery Engine
 *
 * Records step-by-step execution status for idempotent deployment retries,
 * handles UNKNOWN states gracefully, and enables safe recovery after crashes.
 */

export type ExecutionState = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "UNKNOWN";

export interface JournalEntry {
  resourceId: string;
  resourceType: string;
  name: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "REPLACE" | "NO_CHANGE";
  state: ExecutionState;
  arn?: string;
  error?: string;
  startedIso: string;
  updatedIso: string;
}

export interface DeploymentJournalRecord {
  deploymentId: string;
  appName: string;
  environment: string;
  provider: string;
  planHash: string;
  entries: Record<string, JournalEntry>;
  status: ExecutionState;
  createdIso: string;
  updatedIso: string;
}

export class DeploymentJournal {
  private record: DeploymentJournalRecord;

  constructor(deploymentId: string, appName: string, environment: string, provider: string, planHash: string) {
    this.record = {
      deploymentId,
      appName,
      environment,
      provider,
      planHash,
      entries: {},
      status: "PENDING",
      createdIso: new Date().toISOString(),
      updatedIso: new Date().toISOString(),
    };
  }

  /** Start resource execution */
  public startResource(resourceId: string, resourceType: string, name: string, action: JournalEntry["action"]): void {
    const now = new Date().toISOString();
    this.record.entries[resourceId] = {
      resourceId,
      resourceType,
      name,
      action,
      state: "RUNNING",
      startedIso: now,
      updatedIso: now,
    };
    this.record.status = "RUNNING";
    this.record.updatedIso = now;
  }

  /** Mark resource execution success */
  public markSuccess(resourceId: string, arn?: string): void {
    const entry = this.record.entries[resourceId];
    if (entry) {
      entry.state = "SUCCESS";
      entry.arn = arn;
      entry.updatedIso = new Date().toISOString();
    }
    this.updateGlobalStatus();
  }

  /** Mark resource execution failure */
  public markFailure(resourceId: string, error: string): void {
    const entry = this.record.entries[resourceId];
    if (entry) {
      entry.state = "FAILED";
      entry.error = error;
      entry.updatedIso = new Date().toISOString();
    }
    this.updateGlobalStatus();
  }

  /** Mark resource state as UNKNOWN when network/response times out */
  public markUnknown(resourceId: string, reason: string): void {
    const entry = this.record.entries[resourceId];
    if (entry) {
      entry.state = "UNKNOWN";
      entry.error = `Uncertain state: ${reason}`;
      entry.updatedIso = new Date().toISOString();
    }
    this.updateGlobalStatus();
  }

  /** Get journal record JSON */
  public getRecord(): DeploymentJournalRecord {
    return this.record;
  }

  private updateGlobalStatus(): void {
    const states = Object.values(this.record.entries).map((e) => e.state);
    if (states.includes("FAILED") || states.includes("UNKNOWN")) {
      this.record.status = states.includes("UNKNOWN") ? "UNKNOWN" : "FAILED";
    } else if (states.every((s) => s === "SUCCESS")) {
      this.record.status = "SUCCESS";
    }
  }
}
