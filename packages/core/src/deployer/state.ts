/**
 * State Manager & Concurrent Deployment Lock Engine
 *
 * Persists deployment state graph, tracks resource hashes, outputs,
 * enforces deployment locking to prevent concurrent state corruption,
 * and performs state integrity verification.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, copyFileSync, renameSync, openSync, closeSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ResolvedResource } from "../types/resources.js";

export interface DeploymentRecord {
  id: string;
  appName: string;
  environment: string;
  provider: string;
  status: "deployed" | "failed" | "rolled_back";
  resources: ResolvedResource[];
  createdAt: string;
}

export interface StateLockInfo {
  lockId: string;
  appName: string;
  environment: string;
  user: string;
  startedIso: string;
}

export class StateManager {
  private stateDir: string;
  private deployments: Map<string, DeploymentRecord[]> = new Map();

  constructor(projectRoot: string) {
    this.stateDir = join(projectRoot, ".nova", "state");

    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }

    this.load();
  }

  /** Acquire an exclusive file lock to prevent concurrent deployments.
   *
   * Uses O_EXCL (exclusive create) for atomicity — prevents TOCTOU race condition.
   * Two concurrent processes cannot both successfully open the same file with 'wx'.
   */
  public acquireLock(appName: string, environment: string, user = "developer"): StateLockInfo {
    const lockPath = join(this.stateDir, `${appName}-${environment}.lock`);

    const lockInfo: StateLockInfo = {
      lockId: `lock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      appName,
      environment,
      user,
      startedIso: new Date().toISOString(),
    };

    try {
      // O_EXCL flag guarantees atomic exclusive creation — throws EEXIST if lock already exists
      const fd = openSync(lockPath, "wx");
      closeSync(fd);
      writeFileSync(lockPath, JSON.stringify(lockInfo, null, 2));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        // Lock exists — read who holds it for a helpful error message
        try {
          const raw = readFileSync(lockPath, "utf-8");
          const existing = JSON.parse(raw) as StateLockInfo;
          throw new Error(
            `[NovaServe Lock] Deployment already in progress for "${appName}" (${environment}).\n` +
              `Lock ID: ${existing.lockId} | Started: ${existing.startedIso} | User: ${existing.user}`
          );
        } catch (readErr: unknown) {
          if (readErr instanceof Error && readErr.message.includes("[NovaServe Lock]")) {
            throw readErr;
          }
          throw new Error(
            `[NovaServe Lock] Deployment already in progress for "${appName}" (${environment}). ` +
              `Could not read existing lock file.`
          );
        }
      }
      throw err;
    }

    return lockInfo;
  }

  /** Release an acquired deployment lock */
  public releaseLock(appName: string, environment: string): void {
    const lockPath = join(this.stateDir, `${appName}-${environment}.lock`);
    if (existsSync(lockPath)) {
      try {
        unlinkSync(lockPath);
      } catch {
        // Ignore unlink failures
      }
    }
  }

  /** Verify integrity of state records */
  public verifyState(appName: string, environment: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const key = `${appName}:${environment}`;
    const records = this.deployments.get(key) || [];

    if (records.length === 0) {
      return { valid: true, issues: [] };
    }

    for (const r of records) {
      if (!r.id || !r.resources) {
        issues.push(`Deployment record "${r.id || 'unknown'}" has missing structure.`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /** Get currently deployed resources for an app+environment */
  public getResources(appName: string, environment: string): ResolvedResource[] {
    const key = `${appName}:${environment}`;
    const records = this.deployments.get(key) || [];
    const latest = records[records.length - 1];
    return latest?.resources || [];
  }

  /** Get the previous deployment's resources (for rollback) */
  public getPreviousDeployment(appName: string, environment: string): ResolvedResource[] | null {
    const key = `${appName}:${environment}`;
    const records = this.deployments.get(key) || [];

    if (records.length < 2) return null;
    return records[records.length - 2]!.resources;
  }

  /** Save a new deployment record with enriched provider identity */
  public saveDeployment(
    appName: string,
    environment: string,
    provider: string,
    resources: ResolvedResource[]
  ): void {
    const key = `${appName}:${environment}`;

    if (!this.deployments.has(key)) {
      this.deployments.set(key, []);
    }

    const enrichedResources = resources.map((r) => ({
      ...r,
      provider: r.provider || provider,
      providerId: r.providerId || r.id,
    }));

    const record: DeploymentRecord = {
      id: this.generateId(),
      appName,
      environment,
      provider,
      status: "deployed",
      resources: enrichedResources,
      createdAt: new Date().toISOString(),
    };

    this.deployments.get(key)!.push(record);

    const records = this.deployments.get(key)!;
    if (records.length > 10) {
      this.deployments.set(key, records.slice(-10));
    }

    this.persist();
  }

  /** Delete all deployment records for an app+environment */
  public deleteDeployment(appName: string, environment: string): void {
    const key = `${appName}:${environment}`;
    this.deployments.delete(key);
    this.persist();
  }

  /** Get deployment history */
  public getHistory(appName: string, environment: string): DeploymentRecord[] {
    const key = `${appName}:${environment}`;
    return this.deployments.get(key) || [];
  }

  /** Reconcile state by checking live observed resources for UNKNOWN or missing items */
  public reconcileState(
    appName: string,
    environment: string,
    observedState: Record<string, { status: "deployed" | "missing" | "drifted"; arn?: string }>
  ): { reconciledCount: number; updatedResources: string[] } {
    const key = `${appName}:${environment}`;
    const records = this.deployments.get(key) || [];
    if (records.length === 0) return { reconciledCount: 0, updatedResources: [] };

    const latest = records[records.length - 1]!;
    let reconciledCount = 0;
    const updatedResources: string[] = [];

    for (const res of latest.resources) {
      const obs = observedState[res.id] || observedState[`${res.type}-${res.name}`];
      if (obs) {
        if (obs.status === "deployed" && res.status !== "deployed") {
          res.status = "deployed";
          if (obs.arn) {
            res.id = obs.arn;
            res.providerId = obs.arn;
          }
          reconciledCount++;
          updatedResources.push(res.name);
        } else if (obs.status === "missing" && res.status === "deployed") {
          res.status = "failed";
          reconciledCount++;
          updatedResources.push(res.name);
        }
      }
    }

    if (reconciledCount > 0) {
      this.persist();
    }
    return { reconciledCount, updatedResources };
  }

  /** Generate a deterministic config hash for change detection.
   *
   * Uses a custom JSON.stringify replacer function (not array) to produce
   * sorted-key output, ensuring identical objects always produce identical hashes.
   */
  public static hashConfig(config: Record<string, unknown>): string {
    const sortedJson = JSON.stringify(config, (_key: string, value: unknown) => {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value as Record<string, unknown>)
          .sort()
          .reduce((acc: Record<string, unknown>, k) => {
            acc[k] = (value as Record<string, unknown>)[k];
            return acc;
          }, {});
      }
      return value;
    });
    return createHash("sha256").update(sortedJson).digest("hex");
  }

  // ── Private ──────────────────────────────────────────

  private generateId(): string {
    return `deploy-${randomUUID()}`;
  }

  private load(): void {
    try {
      const filePath = join(this.stateDir, "deployments.json");
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        this.deployments = new Map(Object.entries(data));
      }
    } catch {
      this.deployments = new Map();
    }
  }

  private persist(): void {
    try {
      const filePath = join(this.stateDir, "deployments.json");
      const tempPath = join(this.stateDir, "deployments.json.tmp");
      const backupPath = join(this.stateDir, "deployments.json.bak");

      const data = Object.fromEntries(this.deployments);
      const jsonContent = JSON.stringify(data, null, 2);

      // 1. Write to temp file first
      writeFileSync(tempPath, jsonContent);

      // 2. Backup existing state file if present
      if (existsSync(filePath)) {
        try {
          copyFileSync(filePath, backupPath);
        } catch {
          // Ignore backup failure
        }
      }

      // 3. Atomic rename to target path
      renameSync(tempPath, filePath);
    } catch {
      // Best effort persist
    }
  }
}
