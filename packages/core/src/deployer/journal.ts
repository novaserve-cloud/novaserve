import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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

  /** Create instance from existing record */
  public static fromRecord(record: DeploymentJournalRecord): DeploymentJournal {
    const journal = new DeploymentJournal(
      record.deploymentId,
      record.appName,
      record.environment,
      record.provider,
      record.planHash
    );
    journal.record = record;
    return journal;
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

  /** Save journal record to disk under .nova/deployments/<id>.json */
  public saveToDisk(projectRoot: string): void {
    const dir = join(projectRoot, ".nova", "deployments");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const filePath = join(dir, `${this.record.deploymentId}.json`);
    writeFileSync(filePath, JSON.stringify(this.record, null, 2), "utf-8");
  }

  /** Load journal record from disk */
  public static loadFromDisk(projectRoot: string, deploymentId: string): DeploymentJournalRecord | null {
    const filePath = join(projectRoot, ".nova", "deployments", `${deploymentId}.json`);
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }

  /** List all stored deployment journals */
  public static listJournals(projectRoot: string): DeploymentJournalRecord[] {
    const dir = join(projectRoot, ".nova", "deployments");
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const records: DeploymentJournalRecord[] = [];
    for (const f of files) {
      try {
        const content = readFileSync(join(dir, f), "utf-8");
        records.push(JSON.parse(content));
      } catch {
        // Skip unparseable files
      }
    }
    return records.sort((a, b) => new Date(b.createdIso).getTime() - new Date(a.createdIso).getTime());
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
