/**
 * State Manager & Concurrent Deployment Lock Engine
 *
 * Persists deployment state graph, tracks resource hashes, outputs,
 * enforces deployment locking to prevent concurrent state corruption,
 * and performs state integrity verification.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
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

  /** Acquire an exclusive file lock to prevent concurrent deployments */
  public acquireLock(appName: string, environment: string, user = "developer"): StateLockInfo {
    const lockPath = join(this.stateDir, `${appName}-${environment}.lock`);
    if (existsSync(lockPath)) {
      try {
        const raw = readFileSync(lockPath, "utf-8");
        const lock = JSON.parse(raw) as StateLockInfo;
        throw new Error(
          `[NovaServe Lock] Deployment already in progress for "${appName}" (${environment}).\n` +
            `Lock ID: ${lock.lockId} | Started: ${lock.startedIso} | User: ${lock.user}`
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("[NovaServe Lock]")) {
          throw err;
        }
      }
    }

    const lockInfo: StateLockInfo = {
      lockId: `lock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      appName,
      environment,
      user,
      startedIso: new Date().toISOString(),
    };

    writeFileSync(lockPath, JSON.stringify(lockInfo, null, 2));
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

  /** Save a new deployment record */
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

    const record: DeploymentRecord = {
      id: this.generateId(),
      appName,
      environment,
      provider,
      status: "deployed",
      resources,
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

  /** Generate a config hash for change detection */
  public static hashConfig(config: Record<string, unknown>): string {
    return createHash("sha256")
      .update(JSON.stringify(config, Object.keys(config).sort()))
      .digest("hex");
  }

  // ── Private ──────────────────────────────────────────

  private generateId(): string {
    return `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
      const data = Object.fromEntries(this.deployments);
      writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch {
      // Best effort persist
    }
  }
}
