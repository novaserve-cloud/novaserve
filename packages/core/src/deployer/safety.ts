/**
 * Production Safety Engine & Secret Masking Guardrails
 *
 * Enforces deletion protection, prevents accidental destruction of stateful resources,
 * masks sensitive credentials in plans and logs, and guards production environment deployments.
 */

import type { DeploymentPlan, DeploymentPlanAction } from "../types/provider.js";

export interface SafetyValidationOptions {
  environment?: string;
  allowDestructiveInProduction?: boolean;
  forceDestroyProtectedResources?: boolean;
}

export class ProductionSafetyError extends Error {
  constructor(message: string) {
    super(`[Production Safety Error] ${message}`);
    this.name = "ProductionSafetyError";
  }
}

export class ProductionSafetyEngine {
  private static SENSITIVE_KEY_REGEX = /(key|secret|token|password|auth|bearer|cred|private)/i;

  /**
   * Validate a deployment plan against production safety guardrails.
   */
  public static validatePlanSafety(
    plan: DeploymentPlan,
    options: SafetyValidationOptions = {}
  ): { valid: boolean; warnings: string[]; blockedActions: DeploymentPlanAction[] } {
    const warnings: string[] = [];
    const blockedActions: DeploymentPlanAction[] = [];
    const isProduction = (options.environment || plan.environment) === "production";

    for (const action of plan.actions) {
      const rawRes = action.resource;
      const res = rawRes || {
        type: (action as any).resourceType || "unknown",
        name: (action as any).name || "unknown",
        config: {},
      };
      const config = res.config || {};
      const isProtected = Boolean(config.deletionProtection || config.preventDestroy);

      // 1. Enforce deletion protection on stateful resources
      if ((action.action === "delete" || action.action === "replace") && isProtected) {
        if (!options.forceDestroyProtectedResources) {
          blockedActions.push(action);
          warnings.push(
            `Protected resource "${res?.name || 'unknown'}" (${res?.type || 'unknown'}) cannot be ${action.action}d because deletionProtection is enabled.`
          );
        }
      }

      // 2. Production destructive action safeguards
      if (isProduction && (action.action === "delete" || action.action === "replace")) {
        if (!options.allowDestructiveInProduction && !options.forceDestroyProtectedResources) {
          if (!blockedActions.includes(action)) {
            blockedActions.push(action);
          }
          warnings.push(
            `Destructive action "${action.action}" on "${res?.name || 'unknown'}" blocked in production environment without explicit approval.`
          );
        }
      }
    }

    if (blockedActions.length > 0 && !options.forceDestroyProtectedResources) {
      throw new ProductionSafetyError(
        `Blocked ${blockedActions.length} destructive action(s):\n` +
          warnings.map((w) => `  - ${w}`).join("\n") +
          `\nTo force execution, pass options.forceDestroyProtectedResources = true.`
      );
    }

    return {
      valid: blockedActions.length === 0,
      warnings,
      blockedActions,
    };
  }

  /**
   * Recursively mask sensitive fields (API keys, tokens, passwords) in plain objects/strings.
   */
  public static maskSecrets<T>(data: T): T {
    if (data === null || data === undefined) return data;

    if (typeof data === "string") {
      return data as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSecrets(item)) as unknown as T;
    }

    if (typeof data === "object") {
      const masked: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        if (this.SENSITIVE_KEY_REGEX.test(key) && typeof val === "string") {
          masked[key] = "***MASKED***";
        } else if (typeof val === "object" && val !== null) {
          masked[key] = this.maskSecrets(val);
        } else {
          masked[key] = val;
        }
      }
      return masked as T;
    }

    return data;
  }
}
