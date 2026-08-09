/**
 * AWS IAM Service — Real IAM Role & Policy Operations
 *
 * Creates Lambda execution roles with least-privilege inline policies
 * derived from Nova IR permission graph. Supports in-place policy updates,
 * complete ownership tagging, and exponential backoff retry handling.
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
import { awsRetry } from "../utils/retry.js";

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
    appName: string,
    environment = "production"
  ): Promise<string> {
    const roleResult = await awsRetry(() =>
      this.client.send(
        new CreateRoleCommand({
          RoleName: roleName,
          AssumeRolePolicyDocument: LAMBDA_ASSUME_ROLE_POLICY,
          Description: `NovaServe execution role for ${appName}`,
          Tags: [
            { Key: "novaserve:managed", Value: "true" },
            { Key: "novaserve:application", Value: appName },
            { Key: "novaserve:environment", Value: environment },
            { Key: "novaserve:resource", Value: roleName },
            { Key: "novaserve:version", Value: "1.0.0" },
          ],
        })
      )
    );

    const roleArn = roleResult.Role!.Arn!;

    // Attach basic Lambda execution policy (CloudWatch Logs)
    await awsRetry(() =>
      this.client.send(
        new AttachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        })
      )
    );

    // Attach least-privilege inline policy from Nova IR if permissions exist
    await this.updateExecutionRolePolicy(roleName, permissions, appName);

    // Exponential backoff waiter for IAM role propagation
    await awsRetry(
      async () => {
        const res = await this.client.send(new GetRoleCommand({ RoleName: roleName }));
        if (!res.Role?.Arn) throw new Error("IAM role not propagated yet");
      },
      { maxRetries: 6, baseDelayMs: 1000 }
    );

    return roleArn;
  }

  /**
   * Update inline IAM policy in-place when Nova IR permissions change without role recreation
   */
  async updateExecutionRolePolicy(
    roleName: string,
    permissions: NovaIRPermission[],
    appName: string
  ): Promise<void> {
    const policyName = `${appName}-nova-policy`;

    if (!permissions || permissions.length === 0) {
      try {
        await awsRetry(() =>
          this.client.send(
            new DeleteRolePolicyCommand({
              RoleName: roleName,
              PolicyName: policyName,
            })
          )
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "NoSuchEntityException") return;
        throw err;
      }
      return;
    }

    const statements = permissions.map((p) => ({
      Effect: "Allow" as const,
      Action: p.actions,
      Resource: p.resources,
    }));

    await awsRetry(() =>
      this.client.send(
        new PutRolePolicyCommand({
          RoleName: roleName,
          PolicyName: policyName,
          PolicyDocument: JSON.stringify({
            Version: "2012-10-17",
            Statement: statements,
          }),
        })
      )
    );
  }

  /** Check if an IAM role exists and return its ARN */
  async getRole(roleName: string): Promise<string | null> {
    try {
      const result = await awsRetry(() =>
        this.client.send(new GetRoleCommand({ RoleName: roleName }))
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
      const attached = await awsRetry(() =>
        this.client.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName }))
      );
      for (const policy of attached.AttachedPolicies || []) {
        await awsRetry(() =>
          this.client.send(
            new DetachRolePolicyCommand({
              RoleName: roleName,
              PolicyArn: policy.PolicyArn!,
            })
          )
        );
      }

      // Delete inline policies
      const inline = await awsRetry(() =>
        this.client.send(new ListRolePoliciesCommand({ RoleName: roleName }))
      );
      for (const policyName of inline.PolicyNames || []) {
        await awsRetry(() =>
          this.client.send(
            new DeleteRolePolicyCommand({
              RoleName: roleName,
              PolicyName: policyName,
            })
          )
        );
      }

      // Delete the role
      await awsRetry(() => this.client.send(new DeleteRoleCommand({ RoleName: roleName })));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NoSuchEntityException") {
        return; // Already deleted
      }
      throw err;
    }
  }
}
