/**
 * Azure Provider — Centralized Type Definitions
 *
 * Shared interfaces and types used across all Azure service modules,
 * the provider engine, mapper, and inspector.
 */

// ── Provider Options ──────────────────────────────────────────

export interface AzureProviderOptions {
  /** Azure Subscription ID (defaults to AZURE_SUBSCRIPTION_ID env) */
  subscriptionId?: string;
  /** Azure region/location (defaults to AZURE_LOCATION env or "eastus") */
  location?: string;
  /** Explicit resource group override (defaults to auto-generated "{app}-{env}-rg") */
  resourceGroup?: string;
  /** Azure Tenant ID override */
  tenantId?: string;
}

// ── Deployment Context ────────────────────────────────────────

export interface AzureDeploymentContext {
  /** Application name from nova.config.ts */
  appName: string;
  /** Target environment (production, staging, preview, etc.) */
  environment: string;
  /** Resolved Azure Resource Group name */
  resourceGroup: string;
  /** Azure region/location */
  location: string;
  /** NovaServe-managed tags applied to all resources */
  tags: Record<string, string>;
}

/** Build a standard NovaServe tag set for any Azure resource */
export function buildNovaServeTags(
  appName: string,
  environment: string,
  resourceName: string
): Record<string, string> {
  return {
    "novaserve-managed": "true",
    "novaserve-application": appName,
    "novaserve-environment": environment,
    "novaserve-resource": resourceName,
    "novaserve-version": "2.0.0",
  };
}

// ── Resource State ────────────────────────────────────────────

export interface AzureResourceState {
  /** Azure Resource Manager resource ID */
  resourceId: string;
  /** Logical name within NovaServe */
  name: string;
  /** Resource type (function, storage, queue, etc.) */
  type: string;
  /** Azure provisioning state */
  provisioningState: string;
  /** Additional outputs (URLs, connection strings, hostnames) */
  outputs: Record<string, string>;
}

// ── Service Config Interfaces ─────────────────────────────────

export interface AzureKeyVaultConfig {
  /** Vault name (auto-generated from app name if omitted) */
  vaultName?: string;
  /** Secret name */
  secretName: string;
  /** Secret value (for create/update) */
  secretValue?: string;
  /** Enable soft delete */
  softDelete?: boolean;
  /** Purge protection */
  purgeProtection?: boolean;
}

export interface AzureCacheConfig {
  /** Redis cache name */
  cacheName: string;
  /** SKU tier: Basic, Standard, or Premium */
  sku?: "Basic" | "Standard" | "Premium";
  /** SKU family: C (Basic/Standard) or P (Premium) */
  family?: "C" | "P";
  /** Cache capacity (0-6 for C family, 1-5 for P family) */
  capacity?: number;
  /** Enable non-SSL port (default: false) */
  enableNonSslPort?: boolean;
  /** Minimum TLS version */
  minimumTlsVersion?: "1.0" | "1.1" | "1.2";
  /** Redis configuration overrides */
  redisConfiguration?: Record<string, string>;
}

export interface AzureEventGridConfig {
  /** Topic name */
  topicName: string;
  /** Subscription name (for event subscriptions) */
  subscriptionName?: string;
  /** Endpoint URL for webhook subscriptions */
  endpointUrl?: string;
  /** Event types to filter */
  eventTypes?: string[];
  /** Dead letter destination container */
  deadLetterContainer?: string;
}

export interface AzureSchedulerConfig {
  /** Cron expression in NCRONTAB format */
  schedule: string;
  /** Handler file path */
  handler: string;
  /** Function name */
  functionName: string;
  /** Whether the timer should run on startup */
  runOnStartup?: boolean;
}
