/**
 * Nova Cost Intelligence Engine
 *
 * Estimates monthly cloud infrastructure expenditure per resource and provider
 * using differentiated pricing classifications (EXACT, ESTIMATED, USAGE_BASED, UNKNOWN)
 * and identifies cost optimization opportunities.
 */

import type { NovaIRGraph } from "../ir/schema.js";

export type PricingModel = "EXACT" | "ESTIMATED" | "USAGE_BASED" | "UNKNOWN";
export type PricingConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ResourceCostItem {
  resourceId: string;
  resourceName: string;
  type: string;
  estimatedMonthlyUsd: number;
  pricingModel: PricingModel;
  confidence: PricingConfidence;
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
      let pricingModel: PricingModel = "USAGE_BASED";
      let confidence: PricingConfidence = "MEDIUM";

      switch (res.type) {
        case "function": {
          const memory = (res.config.memory as number) || 512;
          if (provider === "gcp") {
            // GCP Cloud Functions: $0.0000025/invocation + $0.0000025/100ms (256MB)
            cost = Number(((memory / 1024) * 2.0 * 1.4).toFixed(2));
            breakdown = `${memory}MB Cloud Function @ ~1M invocations/mo`;
          } else {
            cost = Number(((memory / 1024) * 2.4 * 1.5).toFixed(2));
            breakdown = `${memory}MB memory @ 1M invocations/mo`;
          }
          pricingModel = "USAGE_BASED";
          confidence = "MEDIUM";

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
          if (provider === "gcp") {
            cost = 1.04;
            breakdown = "50GB Cloud Storage Standard + 10k operations";
          } else {
            cost = 1.25;
            breakdown = "50GB S3 Standard storage + 10k PUT/GET requests";
          }
          pricingModel = "USAGE_BASED";
          confidence = "MEDIUM";
          break;
        }
        case "queue": {
          if (provider === "gcp") {
            cost = 0.0;
            breakdown = "Pub/Sub first 10GB/mo free tier";
          } else {
            cost = 0.4;
            breakdown = "SQS standard queue requests (< 1M reqs)";
          }
          pricingModel = "USAGE_BASED";
          confidence = "HIGH";
          break;
        }
        case "database": {
          const engine = (res.config.engine as string) || "postgres";
          if (provider === "gcp") {
            cost = engine === "mysql" ? 12.0 : 15.0;
            breakdown = `Cloud SQL ${engine} db-f1-micro instance`;
          } else {
            cost = engine === "dynamodb" ? 3.5 : 15.0;
            breakdown = `${engine} managed instance / storage`;
          }
          pricingModel = engine === "dynamodb" ? "USAGE_BASED" : "ESTIMATED";
          confidence = "MEDIUM";
          break;
        }
        case "api": {
          if (provider === "gcp") {
            cost = 1.5;
            breakdown = "API Gateway calls (< 1M reqs)";
          } else {
            cost = 2.0;
            breakdown = "API Gateway HTTP API requests (< 1M reqs)";
          }
          pricingModel = "USAGE_BASED";
          confidence = "HIGH";
          break;
        }
        case "cache": {
          if (provider === "gcp") {
            cost = 36.0;
            breakdown = "Memorystore Redis BASIC 1GB instance";
          } else {
            cost = 25.0;
            breakdown = "ElastiCache Redis t3.micro instance";
          }
          pricingModel = "ESTIMATED";
          confidence = "MEDIUM";
          break;
        }
        case "cron": {
          if (provider === "gcp") {
            cost = 0.1;
            breakdown = "Cloud Scheduler 3 free jobs + HTTP target";
          } else {
            cost = 0.0;
            breakdown = "EventBridge scheduler rule (free tier)";
          }
          pricingModel = "USAGE_BASED";
          confidence = "HIGH";
          break;
        }
        case "secret": {
          cost = 0.06;
          breakdown = provider === "gcp"
            ? "Secret Manager: 6 active secret versions @ $0.06/version"
            : "Secrets Manager: $0.40/secret/mo (included in base)";
          pricingModel = "USAGE_BASED";
          confidence = "HIGH";
          break;
        }
        default: {
          cost = 0.5;
          breakdown = "Base resource allocation";
          pricingModel = "UNKNOWN";
          confidence = "LOW";
          break;
        }
      }

      totalMonthlyUsd += cost;
      items.push({
        resourceId: id,
        resourceName: res.name,
        type: res.type,
        estimatedMonthlyUsd: cost,
        pricingModel,
        confidence,
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

