/**
 * Azure Key Vault Service — Real Key Vault Operations
 *
 * Manages Azure Key Vault instances and encrypted secrets using official
 * @azure/arm-keyvault and @azure/keyvault-secrets SDKs.
 * Supports vault creation, secret CRUD, access policies, and soft delete.
 */

import { KeyVaultManagementClient } from "@azure/arm-keyvault";
import { SecretClient } from "@azure/keyvault-secrets";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";
import { buildNovaServeTags } from "../types.js";

export interface KeyVaultSecretState {
  vaultName: string;
  vaultUri: string;
  secretName: string;
  secretVersion: string;
  secretId: string;
}

export class AzureKeyVaultService {
  private armClient: KeyVaultManagementClient;
  private credential: DefaultAzureCredential;
  private subscriptionId: string;
  private tenantId: string;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.credential = credential;
    this.subscriptionId = subscriptionId;
    this.armClient = new KeyVaultManagementClient(credential, subscriptionId);
    this.tenantId = process.env.AZURE_TENANT_ID || "00000000-0000-0000-0000-000000000000";
  }

  /**
   * Create or update a Key Vault and set a secret in it.
   */
  async createVaultAndSecret(
    secretName: string,
    secretValue: string,
    resourceGroup: string,
    location: string,
    appName: string,
    principalId?: string,
    envName = "production"
  ): Promise<KeyVaultSecretState> {
    const vaultName = this.resolveVaultName(appName);

    // 1. Create or update Key Vault with RBAC authorization
    await azureRetry(() =>
      this.armClient.vaults.beginCreateOrUpdateAndWait(resourceGroup, vaultName, {
        location,
        properties: {
          tenantId: this.tenantId,
          sku: { family: "A", name: "standard" },
          enableSoftDelete: true,
          softDeleteRetentionInDays: 30,
          enablePurgeProtection: true,
          enableRbacAuthorization: true,
          accessPolicies: principalId
            ? [
                {
                  tenantId: this.tenantId,
                  objectId: principalId,
                  permissions: {
                    secrets: ["get", "list", "set", "delete"],
                  },
                },
              ]
            : [],
        },
        tags: buildNovaServeTags(appName, envName, secretName),
      })
    );

    // 2. Set the secret value using data-plane SecretClient
    const vaultUri = `https://${vaultName}.vault.azure.net`;
    const secretClient = new SecretClient(vaultUri, this.credential);

    const result = await azureRetry(() =>
      secretClient.setSecret(secretName, secretValue)
    );

    return {
      vaultName,
      vaultUri,
      secretName: result.name,
      secretVersion: result.properties.version || "",
      secretId: result.properties.id || `${vaultUri}/secrets/${secretName}`,
    };
  }

  /**
   * Get a secret value from an existing vault.
   */
  async getSecret(vaultName: string, secretName: string): Promise<string | null> {
    const vaultUri = `https://${vaultName}.vault.azure.net`;
    const secretClient = new SecretClient(vaultUri, this.credential);

    try {
      const result = await azureRetry(() => secretClient.getSecret(secretName));
      return result.value || null;
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "SecretNotFound") return null;
      throw err;
    }
  }

  /**
   * Delete a secret (soft delete).
   */
  async deleteSecret(secretName: string, resourceGroup: string, appName: string): Promise<void> {
    const vaultName = this.resolveVaultName(appName);
    const vaultUri = `https://${vaultName}.vault.azure.net`;
    const secretClient = new SecretClient(vaultUri, this.credential);

    try {
      const poller = await secretClient.beginDeleteSecret(secretName);
      await poller.pollUntilDone();
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === "SecretNotFound") return;
      throw err;
    }
  }

  /**
   * Check if a Key Vault exists.
   */
  async vaultExists(resourceGroup: string, appName: string): Promise<boolean> {
    const vaultName = this.resolveVaultName(appName);
    try {
      await azureRetry(() => this.armClient.vaults.get(resourceGroup, vaultName));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Grant a Managed Identity access to vault secrets.
   */
  async grantAccess(
    resourceGroup: string,
    appName: string,
    principalId: string
  ): Promise<void> {
    const vaultName = this.resolveVaultName(appName);

    const vault = await azureRetry(() =>
      this.armClient.vaults.get(resourceGroup, vaultName)
    );

    const existingPolicies = vault.properties?.accessPolicies || [];
    const alreadyGranted = existingPolicies.some((p) => p.objectId === principalId);
    if (alreadyGranted) return;

    await azureRetry(() =>
      this.armClient.vaults.updateAccessPolicy(
        resourceGroup,
        vaultName,
        "add",
        {
          properties: {
            accessPolicies: [
              {
                tenantId: this.tenantId,
                objectId: principalId,
                permissions: {
                  secrets: ["get", "list"],
                },
              },
            ],
          },
        }
      )
    );
  }

  // ── Private ──────────────────────────────────────────

  private resolveVaultName(appName: string): string {
    // Azure Key Vault names: 3-24 chars, alphanumeric + hyphens only
    return `${appName.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20)}-kv`;
  }
}
