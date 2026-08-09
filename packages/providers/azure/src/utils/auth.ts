/**
 * Azure Authentication & Resource Group Manager
 *
 * Provides DefaultAzureCredential authentication and resolves Subscription ID,
 * Tenant ID, and Resource Group for Azure deployments.
 */

import { DefaultAzureCredential } from "@azure/identity";

export interface AzureAuthStatus {
  subscriptionId: string;
  tenantId?: string;
  resourceGroup: string;
  location: string;
  authenticated: boolean;
}

export class AzureAuthManager {
  private credential: DefaultAzureCredential;
  private subscriptionId: string;
  private location: string;
  private resourceGroup?: string;

  constructor(options?: { subscriptionId?: string; location?: string; resourceGroup?: string }) {
    this.credential = new DefaultAzureCredential();
    this.subscriptionId =
      options?.subscriptionId ||
      process.env.AZURE_SUBSCRIPTION_ID ||
      process.env.ARM_SUBSCRIPTION_ID ||
      "00000000-0000-0000-0000-000000000000";
    this.location = options?.location || process.env.AZURE_LOCATION || "eastus";
    this.resourceGroup = options?.resourceGroup || process.env.AZURE_RESOURCE_GROUP;
  }

  /** Get DefaultAzureCredential instance */
  getCredential(): DefaultAzureCredential {
    return this.credential;
  }

  /** Get active Subscription ID */
  getSubscriptionId(): string {
    return this.subscriptionId;
  }

  /** Get active Location/Region */
  getLocation(): string {
    return this.location;
  }

  /** Resolve Resource Group name for application and environment */
  getResourceGroup(appName: string, environment = "production"): string {
    if (this.resourceGroup) return this.resourceGroup;
    return `${appName}-${environment}-rg`;
  }

  /** Retrieve auth and location status for account safety inspection */
  async getAuthStatus(appName: string, environment = "production"): Promise<AzureAuthStatus> {
    const rg = this.getResourceGroup(appName, environment);
    const tenantId = process.env.AZURE_TENANT_ID;

    return {
      subscriptionId: this.subscriptionId,
      tenantId,
      resourceGroup: rg,
      location: this.location,
      authenticated: Boolean(this.subscriptionId && this.subscriptionId !== "00000000-0000-0000-0000-000000000000"),
    };
  }
}
