/**
 * Cron Resource Builder
 *
 * Define scheduled tasks with cron expressions.
 */

import type { ResourceDefinition } from "../app.js";

/** Cron configuration */
export interface CronConfig {
  /** Handler function to execute */
  handler: string;
  /** Execution timeout (e.g., "5m", "15m") */
  timeout?: string;
  /** Memory allocation in MB */
  memory?: number;
  /** Description of the scheduled task */
  description?: string;
  /** Enable/disable the schedule (default: true) */
  enabled?: boolean;
}

/** Resolved cron resource */
export interface CronResource extends ResourceDefinition {
  readonly _type: "cron";
  readonly _config: CronConfig & { schedule: string } & Record<string, unknown>;
}

/**
 * Cron resource builder.
 *
 * @example
 * ```ts
 * // Every day at 9 AM
 * cron.schedule("0 9 * * *", {
 *   handler: "src/handlers/reports.daily",
 *   timeout: "5m",
 * })
 *
 * // Every hour
 * cron.schedule("0 * * * *", {
 *   handler: "src/handlers/sync.run",
 * })
 *
 * // Using rate expression
 * cron.every("5 minutes", {
 *   handler: "src/handlers/health.check",
 * })
 * ```
 */
export const cron = {
  schedule(expression: string, config: CronConfig): CronResource {
    if (!expression) {
      throw new Error("[NovaServe] Cron expression is required");
    }

    if (!config.handler) {
      throw new Error("[NovaServe] Cron handler is required");
    }

    return {
      _type: "cron",
      _name: `cron-${config.handler.split("/").pop()?.split(".")[0] || "task"}`,
      _config: {
        schedule: expression,
        timeout: "5m",
        memory: 256,
        enabled: true,
        ...config,
      } as CronConfig & { schedule: string } & Record<string, unknown>,
    };
  },

  /**
   * Simple rate-based schedule.
   *
   * @example
   * cron.every("5 minutes", { handler: "src/ping.handler" })
   * cron.every("1 hour", { handler: "src/sync.handler" })
   */
  every(rate: string, config: CronConfig): CronResource {
    // Convert rate expression to a display name
    const name = `every-${rate.replace(/\s+/g, "-")}`;

    return {
      _type: "cron",
      _name: name,
      _config: {
        schedule: `rate(${rate})`,
        timeout: "5m",
        memory: 256,
        enabled: true,
        ...config,
      } as CronConfig & { schedule: string } & Record<string, unknown>,
    };
  },
};
