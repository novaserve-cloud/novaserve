/**
 * AWS IAM Service — Real IAM Role & Policy Operations
 *
 * Creates Lambda execution roles with least-privilege inline policies
 * derived from Nova IR permission graph.
 */

import {
  IAMClient,
  CreateRoleCommand,
  DeleteRoleCommand,
  PutRolePolicyCommand,
  DeleteRolePolicyCommand,
  GetRoleCommand,
  AttachRolePolicyCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
  ListRolePoliciesCommand,
} from "@aws-sdk/client-iam";
import type { NovaIRPermission } from "novaserve-core";

const LAMBDA_ASSUME_ROLE_POLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "lambda.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
});

export class IAMService {
  private client: IAMClient;

  constructor(region: string) {
    this.client = new IAMClient({ region });
  }

  /**
   * Create a Lambda execution role with the basic Lambda execution policy
   * and an inline policy derived from Nova IR permissions.
   */
  async createExecutionRole(
    roleName: string,
    permissions: NovaIRPermission[],
    appName: string
  ): Promise<string> {
    // Create the role
    const createResult = await this.client.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: LAMBDA_ASSUME_ROLE_POLICY,
        Description: `NovaServe execution role for ${appName}`,
        Tags: [
          { Key: "novaserve:app", Value: appName },
          { Key: "novaserve:managed", Value: "true" },
        ],
      })
    );

    const roleArn = createResult.Role!.Arn!;

    // Attach basic Lambda execution policy (CloudWatch Logs)
    await this.client.send(
      new AttachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      })
    );

    // Attach least-privilege inline policy from Nova IR if permissions exist
    if (permissions.length > 0) {
      const statements = permissions.map((p) => ({
        Effect: "Allow" as const,
        Action: p.actions,
        Resource: p.resources,
      }));

      await this.client.send(
        new PutRolePolicyCommand({
          RoleName: roleName,
          PolicyName: `${appName}-nova-policy`,
          PolicyDocument: JSON.stringify({
            Version: "2012-10-17",
            Statement: statements,
          }),
        })
      );
    }

    // IAM role propagation delay — AWS requires a brief wait
    await new Promise((resolve) => setTimeout(resolve, 8000));

    return roleArn;
  }

  /** Check if an IAM role exists and return its ARN */
  async getRole(roleName: string): Promise<string | null> {
    try {
      const result = await this.client.send(
        new GetRoleCommand({ RoleName: roleName })
      );
      return result.Role?.Arn || null;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NoSuchEntityException") {
        return null;
      }
      throw err;
    }
  }

  /** Delete an IAM role and all its attached policies */
  async deleteRole(roleName: string): Promise<void> {
    try {
      // Detach managed policies
      const attached = await this.client.send(
        new ListAttachedRolePoliciesCommand({ RoleName: roleName })
      );
      for (const policy of attached.AttachedPolicies || []) {
        await this.client.send(
          new DetachRolePolicyCommand({
            RoleName: roleName,
            PolicyArn: policy.PolicyArn!,
          })
        );
      }

      // Delete inline policies
      const inline = await this.client.send(
        new ListRolePoliciesCommand({ RoleName: roleName })
      );
      for (const policyName of inline.PolicyNames || []) {
        await this.client.send(
          new DeleteRolePolicyCommand({
            RoleName: roleName,
            PolicyName: policyName,
          })
        );
      }

      // Delete the role
      await this.client.send(new DeleteRoleCommand({ RoleName: roleName }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NoSuchEntityException") {
        return; // Already deleted
      }
      throw err;
    }
  }
}
