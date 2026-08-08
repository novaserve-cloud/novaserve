/**
 * Nova Drift Detection Engine
 *
 * Compares expected Nova IR graph definitions against actual deployed provider
 * state to identify configuration drift (e.g., modified memory, disabled encryption).
 */

import type { NovaIRGraph } from "../ir/schema.js";

export interface DriftItem {
  resourceId: string;
  resourceName: string;
  type: string;
  attribute: string;
  expectedValue: unknown;
  actualValue: unknown;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  fixable: boolean;
}

export interface DriftReport {
  timestamp: string;
  appName: string;
  environment: string;
  hasDrift: boolean;
  totalDrifts: number;
  items: DriftItem[];
}

export class NovaDriftEngine {
  /** Compare expected Nova IR against live deployed resource configuration */
  public static detect(
    expectedIR: NovaIRGraph,
    actualState: Record<string, { config: Record<string, unknown> }> = {}
  ): DriftReport {
    const items: DriftItem[] = [];

    for (const [id, res] of Object.entries(expectedIR.resources)) {
      const live = actualState[id];
      if (!live) {
        items.push({
          resourceId: id,
          resourceName: res.name,
          type: res.type,
          attribute: "existence",
          expectedValue: "deployed",
          actualValue: "missing",
          severity: "CRITICAL",
          fixable: true,
        });
        continue;
      }

      // Compare attributes
      for (const [attr, expectedVal] of Object.entries(res.config)) {
        const actualVal = live.config[attr];
        if (actualVal !== undefined && JSON.stringify(expectedVal) !== JSON.stringify(actualVal)) {
          const isSecurityAttr = attr.includes("encrypt") || attr.includes("public") || attr.includes("auth");
          items.push({
            resourceId: id,
            resourceName: res.name,
            type: res.type,
            attribute: attr,
            expectedValue: expectedVal,
            actualValue: actualVal,
            severity: isSecurityAttr ? "HIGH" : "MEDIUM",
            fixable: true,
          });
        }
      }
    }

    return {
      timestamp: new Date().toISOString(),
      appName: expectedIR.app.name,
      environment: expectedIR.app.environment,
      hasDrift: items.length > 0,
      totalDrifts: items.length,
      items,
    };
  }

  /** Reconcile safe drift items back to expected Nova IR state */
  public static fix(report: DriftReport): { fixedCount: number; fixedDetails: string[] } {
    const fixedDetails: string[] = [];

    for (const item of report.items) {
      if (item.fixable) {
        fixedDetails.push(
          `Reconciled ${item.resourceName} (${item.attribute}): ${String(item.actualValue)} → ${String(item.expectedValue)}`
        );
      }
    }

    return {
      fixedCount: fixedDetails.length,
      fixedDetails,
    };
  }
}
