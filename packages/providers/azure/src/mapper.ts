/**
 * Azure Mapper — Nova IR → Azure Resource Configuration
 *
 * Translates Nova IR graph resources into Azure-specific service configurations.
 * Resolves cross-resource dependencies, generates resource naming,
 * and produces Azure deployment contexts for each resource type.
 */

import type { NovaIRGraph, NovaIRResource } from "novaserve-core";
import { buildNovaServeTags } from "./types.js";
import type {
  AzureKeyVaultConfig,
  AzureCacheConfig,
  AzureEventGridConfig,
  AzureSchedulerConfig,
  AzureDeploymentContext,
} from "./types.js";

// ── Mapped Resource Types ─────────────────────────────────────

export interface AzureMappedResource {
  /** Nova IR logical ID */
  logicalId: string;
  /** Nova IR resource type */
  type: string;
  /** Resolved Azure resource name */
  azureName: string;
  /** Azure service-specific configuration */
  serviceConfig: Record<string, unknown>;
  /** Resources this depends on (logical IDs) */
  dependencies: string[];
  /** Whether this resource needs RBAC bindings */
  requiresRbac: boolean;
  /** RBAC role assignments needed */
  rbacBindings: AzureRbacBinding[];
}

export interface AzureRbacBinding {
  /** Source resource that needs access */
  sourceResourceId: string;
  /** Target resource being accessed */
  targetResourceId: string;
  /** Azure RBAC role definition GUID */
  roleDefinitionId: string;
  /** Description of why this binding is needed */
  reason: string;
}

export interface AzureMappedPlan {
  /** Deployment context */
  context: AzureDeploymentContext;
  /** Mapped resources in dependency order */
  resources: AzureMappedResource[];
  /** All RBAC bindings to apply post-deployment */
  rbacBindings: AzureRbacBinding[];
}

// ── RBAC Role Definition GUIDs ────────────────────────────────

const ROLE_DEFINITIONS = {
  StorageBlobDataContributor: "ba92f5b4-2d11-453d-a403-e96b0029c9fe",
  StorageBlobDataReader: "2a2b9908-6ea1-4ae2-8e65-a410df84e7d1",
  StorageQueueDataContributor: "97474396-4610-4084-997b-c6ac88239438",
  ServiceBusDataSender: "69af8202-86e0-4e8b-8a4d-77636b1b0928",
  ServiceBusDataReceiver: "4f6d3a9b-4b1e-4b10-904f-72648c66e2c3",
  CosmosDBDataContributor: "00000000-0000-0000-0000-000000000002",
  KeyVaultSecretsUser: "4633458b-17de-408a-b874-0445c86b69e6",
  EventGridContributor: "1e241071-0855-49ea-94dc-649edcd759de",
  RedisCacheContributor: "e0f68234-74aa-48ed-b826-c38b57376e17",
} as const;

// ── Mapper Class ──────────────────────────────────────────────

export class AzureMapper {
  /**
   * Map an entire Nova IR graph to Azure resource configurations.
   */
  static mapIRToAzureResources(
    ir: NovaIRGraph,
    context: AzureDeploymentContext
  ): AzureMappedPlan {
    const resources: AzureMappedResource[] = [];
    const allRbacBindings: AzureRbacBinding[] = [];

    // Sort resources by dependency order (infrastructure first, then compute)
    const sortedEntries = AzureMapper.topologicalSort(ir);

    for (const [logicalId, irResource] of sortedEntries) {
      const mapped = AzureMapper.mapSingleResource(logicalId, irResource, context, ir);
      resources.push(mapped);
      allRbacBindings.push(...mapped.rbacBindings);
    }

    // Infer RBAC bindings from IR permissions
    const permissionBindings = AzureMapper.inferRbacFromPermissions(ir);
    allRbacBindings.push(...permissionBindings);

    return {
      context,
      resources,
      rbacBindings: allRbacBindings,
    };
  }

  /**
   * Map a single Nova IR resource to its Azure counterpart.
   */
  private static mapSingleResource(
    logicalId: string,
    res: NovaIRResource,
    context: AzureDeploymentContext,
    ir: NovaIRGraph
  ): AzureMappedResource {
    const rbacBindings: AzureRbacBinding[] = [];

    switch (res.type) {
      case "function": {
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-${res.name}`,
          serviceConfig: {
            handler: res.config.handler,
            runtime: res.config.runtime || "node20",
            memorySize: res.config.memory || 256,
            timeout: res.config.timeout || 30,
            environment: res.config.environment || {},
          },
          dependencies: res.dependencies,
          requiresRbac: true,
          rbacBindings,
        };
      }

      case "api": {
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName.toLowerCase().replace(/[^a-z0-9]/g, "")}-apim`,
          serviceConfig: {
            routes: res.config.routes || {},
            cors: res.config.cors || {},
          },
          dependencies: res.dependencies,
          requiresRbac: false,
          rbacBindings: [],
        };
      }

      case "storage": {
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-${res.name}`.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24),
          serviceConfig: {
            containerName: res.config.containerName || "data",
            maxSize: res.config.maxSize,
            public: res.config.public || false,
          },
          dependencies: res.dependencies,
          requiresRbac: true,
          rbacBindings: [],
        };
      }

      case "queue": {
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-${res.name}`,
          serviceConfig: {
            handler: res.config.handler,
            retries: res.config.retries || 3,
            visibilityTimeout: res.config.visibilityTimeout || 30,
            maxDeliveryCount: res.config.maxDeliveryCount || 10,
          },
          dependencies: res.dependencies,
          requiresRbac: true,
          rbacBindings: [],
        };
      }

      case "database": {
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-${res.name}`,
          serviceConfig: {
            engine: res.config.engine || "cosmosdb",
            version: res.config.version,
            partitionKey: res.config.partitionKey || "id",
            throughput: res.config.throughput,
          },
          dependencies: res.dependencies,
          requiresRbac: true,
          rbacBindings: [],
        };
      }

      case "cache": {
        const cacheConfig: AzureCacheConfig = {
          cacheName: res.name,
          sku: (res.config.sku as AzureCacheConfig["sku"]) || "Standard",
          capacity: (res.config.capacity as number) || 1,
        };
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-${res.name}`,
          serviceConfig: cacheConfig as unknown as Record<string, unknown>,
          dependencies: res.dependencies,
          requiresRbac: true,
          rbacBindings: [],
        };
      }

      case "secret": {
        const kvConfig: AzureKeyVaultConfig = {
          secretName: res.name,
          secretValue: res.config.value as string,
          softDelete: true,
          purgeProtection: true,
        };
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20)}-kv`,
          serviceConfig: kvConfig as unknown as Record<string, unknown>,
          dependencies: res.dependencies,
          requiresRbac: true,
          rbacBindings: [],
        };
      }

      case "cron": {
        const schedConfig: AzureSchedulerConfig = {
          schedule: res.config.schedule as string,
          handler: res.config.handler as string,
          functionName: res.name,
          runOnStartup: (res.config.runOnStartup as boolean) || false,
        };
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-cron-${res.name}`,
          serviceConfig: schedConfig as unknown as Record<string, unknown>,
          dependencies: res.dependencies,
          requiresRbac: true,
          rbacBindings: [],
        };
      }

      case "eventBus":
      case "eventSubscription": {
        const egConfig: AzureEventGridConfig = {
          topicName: res.name,
          subscriptionName: res.config.subscriptionName as string,
          endpointUrl: res.config.endpointUrl as string,
          eventTypes: res.config.eventTypes as string[],
        };
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-${res.name}`,
          serviceConfig: egConfig as unknown as Record<string, unknown>,
          dependencies: res.dependencies,
          requiresRbac: false,
          rbacBindings: [],
        };
      }

      default: {
        return {
          logicalId,
          type: res.type,
          azureName: `${context.appName}-${res.name}`,
          serviceConfig: res.config,
          dependencies: res.dependencies,
          requiresRbac: false,
          rbacBindings: [],
        };
      }
    }
  }

  /**
   * Infer Azure RBAC bindings from Nova IR permission declarations.
   */
  private static inferRbacFromPermissions(ir: NovaIRGraph): AzureRbacBinding[] {
    const bindings: AzureRbacBinding[] = [];

    for (const perm of ir.permissions) {
      for (const targetResId of perm.resources) {
        const targetRes = ir.resources[targetResId];
        if (!targetRes) continue;

        let roleId: string;

        if (perm.actions.some((a) => a.includes("s3:") || a.includes("blob") || a.includes("storage"))) {
          const isReadOnly = perm.actions.every((a) => a.includes("Get") || a.includes("List") || a.includes("Read"));
          roleId = isReadOnly ? ROLE_DEFINITIONS.StorageBlobDataReader : ROLE_DEFINITIONS.StorageBlobDataContributor;
        } else if (perm.actions.some((a) => a.includes("sqs:") || a.includes("queue") || a.includes("servicebus"))) {
          const isSendOnly = perm.actions.every((a) => a.includes("Send") || a.includes("Put"));
          roleId = isSendOnly ? ROLE_DEFINITIONS.ServiceBusDataSender : ROLE_DEFINITIONS.ServiceBusDataReceiver;
        } else if (perm.actions.some((a) => a.includes("dynamodb:") || a.includes("cosmos"))) {
          roleId = ROLE_DEFINITIONS.CosmosDBDataContributor;
        } else if (perm.actions.some((a) => a.includes("secretsmanager:") || a.includes("keyvault") || a.includes("secret"))) {
          roleId = ROLE_DEFINITIONS.KeyVaultSecretsUser;
        } else if (perm.actions.some((a) => a.includes("events:") || a.includes("eventgrid"))) {
          roleId = ROLE_DEFINITIONS.EventGridContributor;
        } else if (perm.actions.some((a) => a.includes("elasticache:") || a.includes("redis"))) {
          roleId = ROLE_DEFINITIONS.RedisCacheContributor;
        } else {
          continue; // Unknown permission type, skip
        }

        bindings.push({
          sourceResourceId: perm.targetFunction,
          targetResourceId: targetResId,
          roleDefinitionId: roleId,
          reason: perm.reason,
        });
      }
    }

    return bindings;
  }

  /**
   * Topological sort of IR resources (infrastructure before compute).
   */
  private static topologicalSort(ir: NovaIRGraph): Array<[string, NovaIRResource]> {
    const entries = Object.entries(ir.resources);

    // Priority order: infrastructure → data → compute → api
    const typePriority: Record<string, number> = {
      secret: 0,
      storage: 1,
      database: 2,
      cache: 3,
      queue: 4,
      eventBus: 5,
      eventSubscription: 6,
      cron: 7,
      function: 8,
      api: 9,
      route: 10,
    };

    return entries.sort(([, a], [, b]) => {
      const pa = typePriority[a.type] ?? 99;
      const pb = typePriority[b.type] ?? 99;
      return pa - pb;
    });
  }
}
