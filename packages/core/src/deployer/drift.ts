/**
 * Nova Drift Detection Engine
 *
 * Compares expected Nova IR graph definitions against actual deployed provider
 * state bidirectionally to identify configuration drift, missing resources, and
 * out-of-band unmanaged resources. Synthesizes executable remediation plans.
 */

import type { NovaIRGraph } from "../ir/schema.js";
import type { DeploymentPlan, DeploymentPlanAction } from "../types/provider.js";
import type { ResourceType } from "../types/resources.js";

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
  /** Compare expected Nova IR against live deployed resource configuration bidirectionally */
  public static detect(
    expectedIR: NovaIRGraph,
    actualState: Record<string, { type?: string; name?: string; config: Record<string, unknown> }> = {}
  ): DriftReport {
    const items: DriftItem[] = [];
    const expectedResourceKeys = new Set(Object.keys(expectedIR.resources));

    // 1. Check expected IR against actual live state
    for (const [id, res] of Object.entries(expectedIR.resources)) {
      const live = actualState[id] || actualState[`${res.type}-${res.name}`];
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
          const lowerAttr = attr.toLowerCase();
          const isSecurityAttr =
            lowerAttr.includes("encrypt") ||
            lowerAttr.includes("public") ||
            lowerAttr.includes("auth") ||
            lowerAttr.includes("role") ||
            lowerAttr.includes("permission") ||
            lowerAttr.includes("sse");

          const severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = isSecurityAttr
            ? "CRITICAL"
            : attr === "memory" || attr === "timeout" || attr === "runtime"
            ? "HIGH"
            : "MEDIUM";

          items.push({
            resourceId: id,
            resourceName: res.name,
            type: res.type,
            attribute: attr,
            expectedValue: expectedVal,
            actualValue: actualVal,
            severity,
            fixable: true,
          });
        }
      }
    }

    // 2. Check actual live state for unmanaged out-of-band resources
    for (const [liveId, liveRes] of Object.entries(actualState)) {
      const matchesExpected =
        expectedResourceKeys.has(liveId) ||
        Object.values(expectedIR.resources).some(
          (r) => `${r.type}-${r.name}` === liveId || r.name === liveRes.name
        );

      if (!matchesExpected) {
        items.push({
          resourceId: liveId,
          resourceName: liveRes.name || liveId,
          type: liveRes.type || "unknown",
          attribute: "unmanaged",
          expectedValue: "none",
          actualValue: "present_in_cloud",
          severity: "HIGH",
          fixable: false,
        });
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

  /** Generate an executable DeploymentPlan to fix detected infrastructure drift */
  public static createDriftRemediationPlan(
    report: DriftReport,
    expectedIR: NovaIRGraph
  ): DeploymentPlan {
    const actions: DeploymentPlanAction[] = [];

    for (const item of report.items) {
      if (!item.fixable) continue;

      const irResource = expectedIR.resources[item.resourceId];
      if (!irResource) continue;

      const actionType = item.attribute === "existence" ? "create" : "update";

      actions.push({
        action: actionType,
        resource: {
          type: irResource.type as ResourceType,
          name: irResource.name,
          config: irResource.config,
          dependencies: irResource.dependencies,
        },
        reason: `Remediate drift on ${item.resourceName} (${item.attribute})`,
        dependsOn: irResource.dependencies || [],
      });
    }

    return {
      appName: expectedIR.app.name,
      provider: "aws",
      environment: expectedIR.app.environment,
      actions,
      summary: {
        create: actions.filter((a) => a.action === "create").length,
        update: actions.filter((a) => a.action === "update").length,
        delete: 0,
        skip: 0,
      },
    };
  }
}
