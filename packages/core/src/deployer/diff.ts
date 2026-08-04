/**
 * Infrastructure Diff
 *
 * Compares current state with desired state to produce
 * a human-readable diff of changes.
 */

import { createHash } from "node:crypto";
import type { Resource, ResolvedResource } from "../types/resources.js";

export type DiffAction = "create" | "update" | "delete" | "unchanged";

export interface DiffEntry {
  action: DiffAction;
  resourceType: string;
  resourceName: string;
  reason: string;
  changes?: Array<{
    field: string;
    from: unknown;
    to: unknown;
  }>;
}

export class InfrastructureDiff {
  /**
   * Compute the diff between desired and current state.
   */
  compute(
    desired: Resource[],
    current: ResolvedResource[]
  ): DiffEntry[] {
    const entries: DiffEntry[] = [];
    const currentMap = new Map<string, ResolvedResource>();

    // Index current resources
    for (const resource of current) {
      const id = `${resource.type}-${resource.name}`;
      currentMap.set(id, resource);
    }

    // Check desired resources against current state
    for (const resource of desired) {
      const id = `${resource.type}-${resource.name}`;
      const existing = currentMap.get(id);

      if (!existing) {
        // New resource
        entries.push({
          action: "create",
          resourceType: resource.type,
          resourceName: resource.name,
          reason: "New resource",
        });
      } else {
        // Check for changes
        const desiredHash = this.hashConfig(resource.config);
        if (desiredHash !== existing.configHash) {
          const changes = this.computeChanges(existing.config, resource.config);
          entries.push({
            action: "update",
            resourceType: resource.type,
            resourceName: resource.name,
            reason: `${changes.length} field(s) changed`,
            changes,
          });
        } else {
          entries.push({
            action: "unchanged",
            resourceType: resource.type,
            resourceName: resource.name,
            reason: "No changes",
          });
        }

        currentMap.delete(id);
      }
    }

    // Remaining current resources should be deleted
    for (const resource of currentMap.values()) {
      entries.push({
        action: "delete",
        resourceType: resource.type,
        resourceName: resource.name,
        reason: "No longer in configuration",
      });
    }

    return entries;
  }

  /**
   * Format a diff for terminal display.
   */
  format(entries: DiffEntry[]): string {
    const lines: string[] = [];

    for (const entry of entries) {
      const icon = this.getActionIcon(entry.action);
      const label = `${entry.resourceType}/${entry.resourceName}`;

      lines.push(`  ${icon} ${label.padEnd(30)} ${entry.reason}`);

      if (entry.changes) {
        for (const change of entry.changes) {
          lines.push(`      ${change.field}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Get summary counts.
   */
  summary(entries: DiffEntry[]): {
    create: number;
    update: number;
    delete: number;
    unchanged: number;
  } {
    return {
      create: entries.filter((e) => e.action === "create").length,
      update: entries.filter((e) => e.action === "update").length,
      delete: entries.filter((e) => e.action === "delete").length,
      unchanged: entries.filter((e) => e.action === "unchanged").length,
    };
  }

  // ── Private ──────────────────────────────────────────

  private hashConfig(config: Record<string, unknown>): string {
    return createHash("sha256")
      .update(JSON.stringify(config, Object.keys(config).sort()))
      .digest("hex");
  }

  private getActionIcon(action: DiffAction): string {
    switch (action) {
      case "create":
        return "+";
      case "update":
        return "~";
      case "delete":
        return "-";
      case "unchanged":
        return " ";
    }
  }

  private computeChanges(
    current: Record<string, unknown>,
    desired: Record<string, unknown>
  ): Array<{ field: string; from: unknown; to: unknown }> {
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

    const allKeys = new Set([...Object.keys(current), ...Object.keys(desired)]);

    for (const key of allKeys) {
      const currentVal = current[key];
      const desiredVal = desired[key];

      if (JSON.stringify(currentVal) !== JSON.stringify(desiredVal)) {
        changes.push({
          field: key,
          from: currentVal,
          to: desiredVal,
        });
      }
    }

    return changes;
  }
}
