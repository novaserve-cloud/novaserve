/**
 * Azure Functions Service — Real Azure Function App Operations
 *
 * Creates, updates, invokes, and deletes Azure Function Apps using official @azure/arm-appservice SDK.
 * Handles App Service Plan creation, ZIP deployment, app settings, and state observation.
 */

import { WebSiteManagementClient, type Site, type AppServicePlan } from "@azure/arm-appservice";
import type { DefaultAzureCredential } from "@azure/identity";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { azureRetry } from "../utils/retry.js";

export interface AzureFunctionConfig {
  functionName: string;
  handler: string;
  runtime: string;
  memorySize?: number;
  environment: Record<string, string>;
  codePath: string;
  appName: string;
  envName?: string;
}

export interface AzureFunctionState {
  functionAppId: string;
  functionAppName: string;
  hostname: string;
  state: string;
  location: string;
  identityPrincipalId?: string;
}

export class AzureFunctionsService {
  private client: WebSiteManagementClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.client = new WebSiteManagementClient(credential, subscriptionId);
  }

  /** Create an App Service Plan & Function App */
  async createFunctionApp(
    config: AzureFunctionConfig,
    resourceGroup: string,
    location: string
  ): Promise<AzureFunctionState> {
    const planName = `${config.appName}-plan`;
    const appName = config.functionName;

    // 1. Ensure Consumption App Service Plan exists
    await azureRetry(() =>
      this.client.appServicePlans.createOrUpdate(resourceGroup, planName, {
        location,
        sku: { name: "Y1", tier: "Dynamic" }, // Consumption Plan
        reserved: true, // Linux
        kind: "linux",
        tags: {
          "novaserve-managed": "true",
          "novaserve-application": config.appName,
          "novaserve-environment": config.envName || "production",
          "novaserve-resource": planName,
          "novaserve-version": "2.0.0",
        },
      })
    );

    const plan = await azureRetry(() =>
      this.client.appServicePlans.get(resourceGroup, planName)
    );

    // 2. Create Function App with System-Assigned Managed Identity
    const siteResult = await azureRetry(() =>
      this.client.webApps.beginCreateOrUpdateAndWait(resourceGroup, appName, {
        location,
        kind: "functionapp,linux",
        serverFarmId: plan.id,
        identity: { type: "SystemAssigned" },
        siteConfig: {
          linuxFxVersion: "NODE|20",
          appSettings: [
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: "1" },
            ...Object.entries(config.environment).map(([name, value]) => ({ name, value })),
          ],
        },
        tags: {
          "novaserve-managed": "true",
          "novaserve-application": config.appName,
          "novaserve-environment": config.envName || "production",
          "novaserve-resource": appName,
          "novaserve-version": "2.0.0",
        },
      })
    );

    // 3. Upload Code ZIP if available
    if (config.codePath) {
      await this.deployZipPackage(resourceGroup, appName, config.codePath);
    }

    return {
      functionAppId: siteResult.id!,
      functionAppName: appName,
      hostname: siteResult.defaultHostName!,
      state: siteResult.state || "Running",
      location: siteResult.location!,
      identityPrincipalId: siteResult.identity?.principalId,
    };
  }

  /** Update Function App code or configuration */
  async updateFunctionApp(
    config: AzureFunctionConfig,
    resourceGroup: string
  ): Promise<void> {
    const appName = config.functionName;

    // Update app settings & configuration
    await azureRetry(() =>
      this.client.webApps.updateApplicationSettings(resourceGroup, appName, {
        properties: {
          FUNCTIONS_WORKER_RUNTIME: "node",
          FUNCTIONS_EXTENSION_VERSION: "~4",
          WEBSITE_RUN_FROM_PACKAGE: "1",
          ...config.environment,
        },
      })
    );

    // Deploy updated code ZIP
    if (config.codePath) {
      await this.deployZipPackage(resourceGroup, appName, config.codePath);
    }
  }

  /** Delete a Function App */
  async deleteFunctionApp(resourceGroup: string, appName: string): Promise<void> {
    try {
      await azureRetry(() => this.client.webApps.delete(resourceGroup, appName));
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return;
      throw err;
    }
  }

  /** Observe live Function App state */
  async getFunctionApp(
    resourceGroup: string,
    appName: string
  ): Promise<AzureFunctionState | null> {
    try {
      const site = await azureRetry(() =>
        this.client.webApps.get(resourceGroup, appName)
      );
      return {
        functionAppId: site.id!,
        functionAppName: site.name!,
        hostname: site.defaultHostName || "",
        state: site.state || "Unknown",
        location: site.location!,
        identityPrincipalId: site.identity?.principalId,
      };
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "ResourceNotFound") return null;
      throw err;
    }
  }

  /** Invoke an Azure Function synchronously over HTTP */
  async invokeFunction(
    hostname: string,
    functionName: string,
    payload: unknown
  ): Promise<{ statusCode: number; body: unknown; durationMs: number }> {
    const start = Date.now();
    const url = `https://${hostname}/api/${functionName}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const bodyText = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText;
      }

      return {
        statusCode: res.status,
        body,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        body: { error: err.message },
        durationMs: Date.now() - start,
      };
    }
  }

  // ── Private ──────────────────────────────────────────

  private async deployZipPackage(
    resourceGroup: string,
    appName: string,
    codePath: string
  ): Promise<void> {
    let zipBuffer: Buffer;
    if (codePath.endsWith(".zip")) {
      zipBuffer = await readFile(codePath);
    } else if (existsSync(join(codePath, "index.js"))) {
      const zipPath = join(codePath, "function.zip");
      execSync(`cd "${codePath}" && zip -r function.zip . -x "*.map"`, { stdio: "pipe" });
      zipBuffer = await readFile(zipPath);
    } else {
      return;
    }

    // Deploy via Kudu zipdeploy endpoint
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
        throw new Error(`Kudu zipdeploy failed with status ${response.status}: ${await response.text()}`);
      }
    });
  }
}
