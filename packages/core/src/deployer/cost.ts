import type { Resource } from "../types/resources.js";
import { toResource } from "../types/resources.js";
import type { NovaApp } from "novaserve-sdk";

export interface CostEstimate {
  resourceName: string;
  monthlyEstimateUsd: number;
  details: string;
}

export interface TotalCostEstimate {
  totalMonthlyUsd: number;
  breakdown: CostEstimate[];
}

/**
 * Basic Cost Estimator
 * Calculates rough monthly cost based on a hypothetical baseline traffic.
 */
export class CostEstimator {
  estimate(app: NovaApp, environment: string): TotalCostEstimate {
    const breakdown: CostEstimate[] = [];
    let total = 0;

    // Assumptions for the estimate (e.g. 1 million requests)
    const assumedInvocations = environment === "production" ? 1_000_000 : 10_000;
    const resources: Resource[] = app.resources.map(toResource);

    for (const resource of resources) {
      let cost = 0;
      let details = "";

      switch (resource.type) {
        case "api":
        case "function": {
          // Lambda pricing: ~$0.20 per 1M requests
          cost = (assumedInvocations / 1_000_000) * 0.20;
          details = `${assumedInvocations} invocations/mo`;
          break;
        }
        case "database": {
          // DynamoDB/Serverless Postgres: assume baseline ~$1.50/mo
          cost = environment === "production" ? 5.00 : 0.50;
          details = "Serverless DB capacity";
          break;
        }
        case "storage": {
          // S3/R2: ~$0.023 per GB, assume 10GB
          cost = environment === "production" ? 0.23 : 0.05;
          details = "10GB storage estimate";
          break;
        }
        default:
          cost = 0;
          details = "Free tier or unknown";
      }

      total += cost;
      breakdown.push({
        resourceName: resource.name,
        monthlyEstimateUsd: cost,
        details,
      });
    }

    return {
      totalMonthlyUsd: Number(total.toFixed(2)),
      breakdown,
    };
  }
}
