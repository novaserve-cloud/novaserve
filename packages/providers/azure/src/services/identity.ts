/**
 * Azure Identity & RBAC Service — Managed Identity & Role Assignments
 *
 * Compiles Nova IR permissions to least-privilege Azure RBAC Role Assignments
 * for Azure Managed Identities.
 */

import { AuthorizationManagementClient } from "@azure/arm-authorization";
import type { DefaultAzureCredential } from "@azure/identity";
import type { NovaIRPermission } from "novaserve-core";
import { randomUUID } from "node:crypto";
import { azureRetry } from "../utils/retry.js";

/** Standard Built-in Azure RBAC Role Definitions */
export const AZURE_BUILTIN_ROLES = {
  StorageBlobDataReader: "2a2b9908-6ea1-4ae2-8e65-a410df84e7d1",
  StorageBlobDataContributor: "ba92f5b4-2d11-453d-a403-e96b0029c9fe",
  StorageQueueDataContributor: "97474396-4610-4084-997b-c6ac88239438",
  ServiceBusDataSender: "69af8202-86e0-4e8b-8a4d-77636b1b0928",
  ServiceBusDataReceiver: "4f6d3a9b-4b1e-4b10-904f-72648c66e2c3",
  CosmosDBDataContributor: "00000000-0000-0000-0000-000000000002",
};

export class AzureIdentityService {
  private client: AuthorizationManagementClient;
  private subscriptionId: string;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.subscriptionId = subscriptionId;
    this.client = new AuthorizationManagementClient(credential, subscriptionId);
  }

  /**
   * Assign least-privilege Azure RBAC role to a Managed Identity Principal ID
   */
  async assignRole(
    principalId: string,
    roleDefinitionId: string,
    scope: string
  ): Promise<string> {
    const roleAssignmentName = randomUUID();
    const fullRoleDefId = `/subscriptions/${this.subscriptionId}/providers/Microsoft.Authorization/roleDefinitions/${roleDefinitionId}`;

    const assignment = await azureRetry(() =>
      this.client.roleAssignments.create(scope, roleAssignmentName, {
        principalId,
        roleDefinitionId: fullRoleDefId,
        principalType: "ServicePrincipal",
      })
    );

    return assignment.id!;
  }

  /**
   * Map Nova IR permissions to Azure RBAC role assignments
   */
  async applyPermissions(
    principalId: string,
    permissions: NovaIRPermission[],
    resourceScopeMap: Record<string, string>
  ): Promise<void> {
    if (!permissions || permissions.length === 0) return;

    for (const perm of permissions) {
      for (const resTarget of perm.resources) {
        const scope = resourceScopeMap[resTarget] || `/subscriptions/${this.subscriptionId}`;
        let roleId = AZURE_BUILTIN_ROLES.StorageBlobDataContributor;

        if (perm.actions.some((a) => a.includes("s3:") || a.includes("blob"))) {
          roleId = AZURE_BUILTIN_ROLES.StorageBlobDataContributor;
        } else if (perm.actions.some((a) => a.includes("sqs:") || a.includes("queue"))) {
          roleId = AZURE_BUILTIN_ROLES.StorageQueueDataContributor;
        } else if (perm.actions.some((a) => a.includes("dynamodb:") || a.includes("cosmos"))) {
          roleId = AZURE_BUILTIN_ROLES.CosmosDBDataContributor;
        }

        try {
          await this.assignRole(principalId, roleId, scope);
        } catch (err: any) {
          // Ignore if role assignment already exists
          if (err.code !== "RoleAssignmentExists") {
            throw err;
          }
        }
      }
    }
  }
}
