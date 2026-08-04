/**
 * State Manager
 *
 * Persists deployment state using SQLite.
 * Tracks deployed resources, config hashes, and outputs
 * to enable incremental deployments and rollbacks.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { ResolvedResource, ResourceStatus } from "../types/resources.js";

/**
 * In-memory state store (SQLite integration in production).
 * For MVP, we use a JSON file-based approach.
 */

interface DeploymentRecord {
  id: string;
  appName: string;
  environment: string;
  provider: string;
  status: "deployed" | "failed" | "rolled_back";
  resources: ResolvedResource[];
  createdAt: string;
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

  /**
   * Get currently deployed resources for an app+environment.
   */
  getResources(appName: string, environment: string): ResolvedResource[] {
    const key = `${appName}:${environment}`;
    const records = this.deployments.get(key) || [];
    const latest = records[records.length - 1];
    return latest?.resources || [];
  }

  /**
   * Get the previous deployment's resources (for rollback).
   */
  getPreviousDeployment(
    appName: string,
    environment: string
  ): ResolvedResource[] | null {
    const key = `${appName}:${environment}`;
    const records = this.deployments.get(key) || [];

    if (records.length < 2) return null;
    return records[records.length - 2]!.resources;
  }

  /**
   * Save a new deployment record.
   */
  saveDeployment(
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

    // Keep only last 10 deployments
    const records = this.deployments.get(key)!;
    if (records.length > 10) {
      this.deployments.set(key, records.slice(-10));
    }

    this.persist();
  }

  /**
   * Delete all deployment records for an app+environment.
   */
  deleteDeployment(appName: string, environment: string): void {
    const key = `${appName}:${environment}`;
    this.deployments.delete(key);
    this.persist();
  }

  /**
   * Get deployment history.
   */
  getHistory(
    appName: string,
    environment: string
  ): DeploymentRecord[] {
    const key = `${appName}:${environment}`;
    return this.deployments.get(key) || [];
  }

  /**
   * Generate a config hash for change detection.
   */
  static hashConfig(config: Record<string, unknown>): string {
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
        const { readFileSync } = require("node:fs");
        const data = JSON.parse(readFileSync(filePath, "utf-8"));
        this.deployments = new Map(Object.entries(data));
      }
    } catch {
      // Start fresh if state is corrupted
      this.deployments = new Map();
    }
  }

  private persist(): void {
    try {
      const filePath = join(this.stateDir, "deployments.json");
      const { writeFileSync } = require("node:fs");
      const data = Object.fromEntries(this.deployments);
      writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch {
      // Silently fail — state persistence is best-effort
    }
  }
}
