/**
 * Nova Planner & Diff Engine
 *
 * Generates Nova deployment plans, resource diffs, estimated deployment duration,
 * and monthly cost estimates directly from Nova IR graph comparisons.
 */

import type { NovaIRGraph, NovaIRResource } from "../ir/schema.js";

export interface ResourceDiffItem {
  attribute: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface NovaPlanAction {
  action: "create" | "update" | "delete" | "skip";
  resourceId: string;
  resourceType: string;
  name: string;
  reason: string;
  estimatedSeconds: number;
  estimatedMonthlyCostUsd: number;
  diffs?: ResourceDiffItem[];
  dependsOn: string[];
}

export interface NovaPlanResult {
  appName: string;
  environment: string;
  provider: string;
  irHash: string;
  actions: NovaPlanAction[];
  summary: {
    create: number;
    update: number;
    delete: number;
    skip: number;
  };
  totalEstimatedSeconds: number;
  totalEstimatedMonthlyCostUsd: number;
}

/** Compute approximate monthly cost for a resource type */
function estimateResourceMonthlyCost(type: string, config: Record<string, unknown>): number {
  switch (type) {
    case "function": {
      const memory = (config.memory as number) || 512;
      return Number(((memory / 1024) * 2.4).toFixed(2)); // ~$1.20 - $4.80/mo
    }
    case "api":
      return 1.5;
    case "storage":
      return 0.8;
    case "queue":
      return 0.4;
    case "database": {
      const engine = (config.engine as string) || "postgres";
      return engine === "dynamodb" ? 2.5 : 12.0;
    }
    case "cache":
      return 8.0;
    default:
      return 0.5;
  }
}

/** Estimate deployment execution duration in seconds */
function estimateResourceDeployTime(type: string): number {
  switch (type) {
    case "function": return 4;
    case "api": return 6;
    case "storage": return 3;
    case "queue": return 2;
    case "database": return 15;
    case "cache": return 10;
    default: return 3;
  }
}

export class NovaPlanner {
  /** Generate deployment plan comparing new Nova IR with active state */
  public static plan(
    newIR: NovaIRGraph,
    activeState: Record<string, { configHash: string; config: Record<string, unknown> }> = {},
    provider = "aws"
  ): NovaPlanResult {
    const actions: NovaPlanAction[] = [];
    const summary = { create: 0, update: 0, delete: 0, skip: 0 };
    let totalEstimatedSeconds = 0;
    let totalEstimatedMonthlyCostUsd = 0;

    const newResKeys = new Set(Object.keys(newIR.resources));
    const activeResKeys = new Set(Object.keys(activeState));

    // Check additions and updates
    for (const [id, res] of Object.entries(newIR.resources)) {
      const existing = activeState[id];
      const monthlyCost = estimateResourceMonthlyCost(res.type, res.config);
      totalEstimatedMonthlyCostUsd += monthlyCost;

      if (!existing) {
        // Resource creation (+)
        const sec = estimateResourceDeployTime(res.type);
        actions.push({
          action: "create",
          resourceId: id,
          resourceType: res.type,
          name: res.name,
          reason: "New resource defined in Nova IR",
          estimatedSeconds: sec,
          estimatedMonthlyCostUsd: monthlyCost,
          dependsOn: res.dependencies,
        });
        summary.create++;
        totalEstimatedSeconds += sec;
      } else if (existing.configHash !== res.configHash) {
        // Resource update (~)
        const sec = Math.max(2, Math.floor(estimateResourceDeployTime(res.type) * 0.6));
        const diffs: ResourceDiffItem[] = [];

        // Compare config keys
        const allKeys = new Set([...Object.keys(existing.config || {}), ...Object.keys(res.config || {})]);
        for (const k of allKeys) {
          if (JSON.stringify(existing.config[k]) !== JSON.stringify(res.config[k])) {
            diffs.push({
              attribute: k,
              oldValue: existing.config[k],
              newValue: res.config[k],
            });
          }
        }

        actions.push({
          action: "update",
          resourceId: id,
          resourceType: res.type,
          name: res.name,
          reason: `Config hash modified (${existing.configHash.slice(0, 7)} → ${res.configHash.slice(0, 7)})`,
          estimatedSeconds: sec,
          estimatedMonthlyCostUsd: monthlyCost,
          diffs,
          dependsOn: res.dependencies,
        });
        summary.update++;
        totalEstimatedSeconds += sec;
      } else {
        // Unchanged / skip
        actions.push({
          action: "skip",
          resourceId: id,
          resourceType: res.type,
          name: res.name,
          reason: "Config unchanged",
          estimatedSeconds: 0,
          estimatedMonthlyCostUsd: monthlyCost,
          dependsOn: res.dependencies,
        });
        summary.skip++;
      }
    }

    // Check deletions (-)
    for (const activeId of activeResKeys) {
      if (!newResKeys.has(activeId)) {
        actions.push({
          action: "delete",
          resourceId: activeId,
          resourceType: activeId.split("-")[0] || "custom",
          name: activeId.split("-").slice(1).join("-") || activeId,
          reason: "Removed from Nova IR graph",
          estimatedSeconds: 3,
          estimatedMonthlyCostUsd: 0,
          dependsOn: [],
        });
        summary.delete++;
        totalEstimatedSeconds += 3;
      }
    }

    return {
      appName: newIR.app.name,
      environment: newIR.app.environment,
      provider,
      irHash: newIR.app.hash,
      actions,
      summary,
      totalEstimatedSeconds: Math.ceil(totalEstimatedSeconds * 0.7), // parallel reduction factor
      totalEstimatedMonthlyCostUsd: Number(totalEstimatedMonthlyCostUsd.toFixed(2)),
    };
  }
}
