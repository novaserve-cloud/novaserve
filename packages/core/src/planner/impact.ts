/**
 * Nova Impact & Blast Radius Analysis Engine
 *
 * Traverses Nova IR graph topology to determine direct and indirect dependents,
 * affected HTTP routes, permissions, and risk score when a resource changes.
 */

import type { NovaIRGraph } from "../ir/schema.js";

export interface ImpactAnalysisResult {
  targetResourceId: string;
  targetName: string;
  targetType: string;
  directDependents: string[];
  indirectDependents: string[];
  affectedRoutes: string[];
  totalAffected: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
}

export class NovaImpactAnalyzer {
  /** Analyze blast-radius impact of modifying or replacing a resource */
  public static analyze(ir: NovaIRGraph, targetId: string): ImpactAnalysisResult {
    const resMap = ir.resources || {};
    let target = resMap[targetId];

    // Fuzzy lookup by name or prefix if exact ID not found
    if (!target) {
      const matchKey = Object.keys(resMap).find((k) => k === targetId || k.endsWith(`-${targetId}`));
      if (matchKey) {
        target = resMap[matchKey];
        targetId = matchKey;
      }
    }

    if (!target) {
      return {
        targetResourceId: targetId,
        targetName: targetId,
        targetType: "unknown",
        directDependents: [],
        indirectDependents: [],
        affectedRoutes: [],
        totalAffected: 0,
        riskLevel: "LOW",
        explanation: `Resource "${targetId}" not found in Nova IR graph.`,
      };
    }

    const directDependents = new Set<string>();
    const indirectDependents = new Set<string>();

    // Find direct dependents (resources that list targetId in their dependencies)
    for (const [id, r] of Object.entries(resMap)) {
      if (r.dependencies && r.dependencies.includes(targetId)) {
        directDependents.add(id);
      }
    }

    // Traverse BFS to find indirect dependents
    const queue = Array.from(directDependents);
    const visited = new Set(queue);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const [id, r] of Object.entries(resMap)) {
        if (!visited.has(id) && r.dependencies && r.dependencies.includes(currentId)) {
          visited.add(id);
          indirectDependents.add(id);
          queue.push(id);
        }
      }
    }

    const affectedRoutes: string[] = [];
    for (const id of Array.from(visited)) {
      const r = resMap[id];
      if (r && r.type === "api" && r.config && typeof r.config.routes === "object") {
        affectedRoutes.push(...Object.keys(r.config.routes as Record<string, unknown>));
      }
    }

    const totalAffected = directDependents.size + indirectDependents.size;
    let riskLevel: ImpactAnalysisResult["riskLevel"] = "LOW";
    if (target.type === "database" || totalAffected >= 5) {
      riskLevel = "HIGH";
    } else if (totalAffected >= 2 || target.type === "queue") {
      riskLevel = "MEDIUM";
    }

    return {
      targetResourceId: targetId,
      targetName: target.name,
      targetType: target.type,
      directDependents: Array.from(directDependents),
      indirectDependents: Array.from(indirectDependents),
      affectedRoutes,
      totalAffected,
      riskLevel,
      explanation: `Modifying ${target.name} (${target.type}) impacts ${directDependents.size} direct and ${indirectDependents.size} indirect resources across the infrastructure topology.`,
    };
  }
}
