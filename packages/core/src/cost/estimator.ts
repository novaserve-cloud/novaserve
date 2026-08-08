/**
 * Nova Cost Intelligence Engine
 *
 * Estimates monthly cloud infrastructure expenditure per resource and provider
 * and identifies cost optimization opportunities.
 */

import type { NovaIRGraph } from "../ir/schema.js";

export interface ResourceCostItem {
  resourceId: string;
  resourceName: string;
  type: string;
  estimatedMonthlyUsd: number;
  breakdown: string;
  optimizationAdvice?: string;
}

export interface CostEstimateReport {
  appName: string;
  provider: string;
  totalMonthlyUsd: number;
  items: ResourceCostItem[];
  optimizations: Array<{
    resourceId: string;
    currentCostUsd: number;
    recommendedCostUsd: number;
    savingsUsd: number;
    advice: string;
  }>;
}

export class NovaCostEstimator {
  public static estimate(ir: NovaIRGraph, provider = "aws"): CostEstimateReport {
    const items: ResourceCostItem[] = [];
    const optimizations: CostEstimateReport["optimizations"] = [];
    let totalMonthlyUsd = 0;

    for (const [id, res] of Object.entries(ir.resources)) {
      let cost = 0;
      let breakdown = "";
      let advice: string | undefined;

      switch (res.type) {
        case "function": {
          const memory = (res.config.memory as number) || 512;
          const monthlyInvocations = 1000000; // default 1M estimate
          cost = Number(((memory / 1024) * 2.4 * 1.5).toFixed(2));
          breakdown = `${memory}MB memory @ 1M invocations/mo`;

          if (memory > 512) {
            const recommendedCost = Number(((256 / 1024) * 2.4 * 1.5).toFixed(2));
            const savings = Number((cost - recommendedCost).toFixed(2));
            advice = `Consider tuning memory from ${memory}MB to 256MB based on metrics.`;
            optimizations.push({
              resourceId: id,
              currentCostUsd: cost,
              recommendedCostUsd: recommendedCost,
              savingsUsd: savings,
              advice: `Reduce ${res.name} memory from ${memory}MB to 256MB (saves $${savings}/mo).`,
            });
          }
          break;
        }
        case "storage": {
          cost = 1.25;
          breakdown = "50GB S3 Standard storage + 10k PUT/GET requests";
          break;
        }
        case "queue": {
          cost = 0.4;
          breakdown = "SQS standard queue requests (< 1M reqs)";
          break;
        }
        case "database": {
          const engine = (res.config.engine as string) || "postgres";
          cost = engine === "dynamodb" ? 3.5 : 15.0;
          breakdown = `${engine} managed instance / storage`;
          break;
        }
        case "api": {
          cost = 2.0;
          breakdown = "API Gateway HTTP API requests (< 1M reqs)";
          break;
        }
        default: {
          cost = 0.5;
          breakdown = "Base resource allocation";
          break;
        }
      }

      totalMonthlyUsd += cost;
      items.push({
        resourceId: id,
        resourceName: res.name,
        type: res.type,
        estimatedMonthlyUsd: cost,
        breakdown,
        optimizationAdvice: advice,
      });
    }

    return {
      appName: ir.app.name,
      provider,
      totalMonthlyUsd: Number(totalMonthlyUsd.toFixed(2)),
      items,
      optimizations,
    };
  }
}
