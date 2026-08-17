/**
 * Azure Scheduler Service — Timer-Triggered Azure Functions (Cron)
 *
 * Maps Nova IR `cron` resources to Azure Functions with timer triggers.
 * Uses NCRONTAB expression format and manages function app settings
 * for schedule configuration.
 */

import { WebSiteManagementClient } from "@azure/arm-appservice";
import type { DefaultAzureCredential } from "@azure/identity";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { azureRetry } from "../utils/retry.js";
import { buildNovaServeTags } from "../types.js";

export interface AzureSchedulerState {
  functionAppId: string;
  functionAppName: string;
  hostname: string;
  schedule: string;
  state: string;
  identityPrincipalId?: string;
}

export class AzureSchedulerService {
  private client: WebSiteManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.client = new WebSiteManagementClient(credential, subscriptionId);
  }

  /**
   * Create a timer-triggered Azure Function App for cron schedules.
   *
   * Azure Functions timer triggers use NCRONTAB format:
   * - Standard:  "{second} {minute} {hour} {day} {month} {day-of-week}"
   * - Example:   "0 0 0 * * *" = every day at midnight
   *
   * NovaServe cron uses 5-field Unix format, so we prepend "0" for seconds.
   */
  async createScheduledFunction(
    functionName: string,
    schedule: string,
    resourceGroup: string,
    location: string,
    appName: string,
    config: {
      handler?: string;
      codePath?: string;
      environment?: Record<string, string>;
      runOnStartup?: boolean;
    } = {},
    envName = "production"
  ): Promise<AzureSchedulerState> {
    const cleanName = `${appName}-cron-${functionName}`;
    const planName = `${appName}-cron-plan`;

    // Convert 5-field Unix cron to 6-field NCRONTAB (prepend seconds=0)
    const ncrontab = this.toNCRONTAB(schedule);

    // 1. Ensure a Consumption App Service Plan exists for cron functions
    await azureRetry(() =>
      this.client.appServicePlans.createOrUpdate(resourceGroup, planName, {
        location,
        sku: { name: "Y1", tier: "Dynamic" },
        reserved: true,
        kind: "linux",
        tags: buildNovaServeTags(appName, envName, planName),
      })
    );

    const plan = await azureRetry(() =>
      this.client.appServicePlans.get(resourceGroup, planName)
    );

    // 2. Create Function App with timer trigger configuration
    const appSettings = [
      { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
      { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
      { name: "WEBSITE_RUN_FROM_PACKAGE", value: "1" },
      { name: "NOVA_CRON_SCHEDULE", value: ncrontab },
      { name: "NOVA_CRON_RUN_ON_STARTUP", value: String(config.runOnStartup ?? false) },
      ...Object.entries(config.environment || {}).map(([name, value]) => ({ name, value })),
    ];

    const siteResult = await azureRetry(() =>
      this.client.webApps.beginCreateOrUpdateAndWait(resourceGroup, cleanName, {
        location,
        kind: "functionapp,linux",
        serverFarmId: plan.id,
        identity: { type: "SystemAssigned" },
        siteConfig: {
          linuxFxVersion: "NODE|20",
          appSettings,
        },
        tags: {
          ...buildNovaServeTags(appName, envName, functionName),
          "novaserve-cron-schedule": schedule,
        },
      })
    );

    // 3. Deploy handler code if provided
    if (config.codePath) {
      await this.deployTimerFunction(resourceGroup, cleanName, config.codePath, ncrontab);
    }

    return {
      functionAppId: siteResult.id!,
      functionAppName: cleanName,
      hostname: siteResult.defaultHostName!,
      schedule: ncrontab,
      state: siteResult.state || "Running",
      identityPrincipalId: siteResult.identity?.principalId,
    };
  }

  /**
   * Update the cron schedule for an existing timer-triggered function.
   */
  async updateSchedule(
    functionName: string,
    schedule: string,
    resourceGroup: string,
    appName: string,
    config: { environment?: Record<string, string> } = {}
  ): Promise<void> {
    const cleanName = `${appName}-cron-${functionName}`;
    const ncrontab = this.toNCRONTAB(schedule);

    await azureRetry(() =>
      this.client.webApps.updateApplicationSettings(resourceGroup, cleanName, {
        properties: {
          FUNCTIONS_WORKER_RUNTIME: "node",
          FUNCTIONS_EXTENSION_VERSION: "~4",
          WEBSITE_RUN_FROM_PACKAGE: "1",
          NOVA_CRON_SCHEDULE: ncrontab,
          ...(config.environment || {}),
        },
      })
    );
  }

  /**
   * Get the current state of a timer-triggered function.
   */
  async getScheduledFunction(
    functionName: string,
    resourceGroup: string,
    appName: string
  ): Promise<AzureSchedulerState | null> {
    const cleanName = `${appName}-cron-${functionName}`;

    try {
      const site = await azureRetry(() =>
        this.client.webApps.get(resourceGroup, cleanName)
      );

      // Read schedule from app tags
      const schedule = site.tags?.["novaserve-cron-schedule"] || "";

      return {
        functionAppId: site.id!,
        functionAppName: cleanName,
        hostname: site.defaultHostName || "",
        schedule,
        state: site.state || "Unknown",
        identityPrincipalId: site.identity?.principalId,
      };
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return null;
      throw err;
    }
  }

  /**
   * Delete a timer-triggered function app.
   */
  async deleteScheduledFunction(
    functionName: string,
    resourceGroup: string,
    appName: string
  ): Promise<void> {
    const cleanName = `${appName}-cron-${functionName}`;

    try {
      await azureRetry(() => this.client.webApps.delete(resourceGroup, cleanName));
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }

  // ── Private ──────────────────────────────────────────

  /**
   * Convert 5-field Unix cron expression to 6-field Azure NCRONTAB.
   * Unix: "minute hour day month day-of-week"
   * NCRONTAB: "second minute hour day month day-of-week"
   */
  private toNCRONTAB(unixCron: string): string {
    const parts = unixCron.trim().split(/\s+/);
    if (parts.length === 6) return unixCron; // Already NCRONTAB
    if (parts.length === 5) return `0 ${unixCron}`; // Prepend seconds=0
    throw new Error(`Invalid cron expression: "${unixCron}". Expected 5-field Unix or 6-field NCRONTAB format.`);
  }

  /**
   * Deploy a timer trigger function.json + handler code via ZIP deployment.
   */
  private async deployTimerFunction(
    resourceGroup: string,
    appName: string,
    codePath: string,
    schedule: string
  ): Promise<void> {
    // Generate function.json for timer trigger
    const functionJson = JSON.stringify({
      bindings: [
        {
          name: "timerTrigger",
          type: "timerTrigger",
          direction: "in",
          schedule,
        },
      ],
    });

    let zipBuffer: Buffer;
    if (codePath.endsWith(".zip")) {
      zipBuffer = await readFile(codePath);
    } else if (existsSync(join(codePath, "index.js"))) {
      // Write function.json into the code directory before zipping
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(codePath, "function.json"), functionJson);

      const zipPath = join(codePath, "function.zip");
      execSync(`cd "${codePath}" && zip -r function.zip . -x "*.map"`, { stdio: "pipe" });
      zipBuffer = await readFile(zipPath);
    } else {
      return;
    }

    // Deploy via Kudu zipdeploy
    await azureRetry(async () => {
      const site = await this.client.webApps.get(resourceGroup, appName);
      const scmHost = site.enabledHostNames?.find((h) => h.includes(".scm.")) || `${appName}.scm.azurewebsites.net`;
      const url = `https://${scmHost}/api/zipdeploy`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: zipBuffer,
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`Kudu zipdeploy failed for cron function with status ${response.status}: ${await response.text()}`);
      }
    });
  }
}
