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
  GetRolePolicyCommand,
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
   * Synthesize least-privilege IAM permissions from Nova IR graph resource dependencies
   */
  public synthesizeGraphPermissions(
    dependencies: string[],
    allResources: Array<{ type: string; name: string }>,
    appName: string,
    region: string,
    accountId = "*"
  ): NovaIRPermission[] {
    const permissions: NovaIRPermission[] = [];
    const resourceMap = new Map<string, { type: string; name: string }>();

    for (const r of allResources) {
      resourceMap.set(r.name, r);
    }

    for (const depName of dependencies) {
      const target = resourceMap.get(depName);
      if (!target) continue;

      const physicalName = `${appName}-${depName}`;

      switch (target.type) {
        case "storage":
          permissions.push({
            id: `perm-${appName}-${depName}-storage`,
            targetFunction: depName,
            actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
            resources: [`arn:aws:s3:::${physicalName}/*`, `arn:aws:s3:::${physicalName}`],
            reason: `Graph binding access to S3 storage "${depName}"`,
          });
          break;

        case "queue":
          permissions.push({
            id: `perm-${appName}-${depName}-queue`,
            targetFunction: depName,
            actions: [
              "sqs:SendMessage",
              "sqs:ReceiveMessage",
              "sqs:DeleteMessage",
              "sqs:GetQueueAttributes",
            ],
            resources: [`arn:aws:sqs:${region}:${accountId}:${physicalName}`],
            reason: `Graph binding access to SQS queue "${depName}"`,
          });
          break;

        case "database":
          permissions.push({
            id: `perm-${appName}-${depName}-database`,
            targetFunction: depName,
            actions: [
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem",
              "dynamodb:Query",
              "dynamodb:Scan",
            ],
            resources: [
              `arn:aws:dynamodb:${region}:${accountId}:table/${physicalName}`,
              `arn:aws:dynamodb:${region}:${accountId}:table/${physicalName}/index/*`,
            ],
            reason: `Graph binding access to DynamoDB table "${depName}"`,
          });
          break;
      }
    }

    return permissions;
  }

  /**
   * Create a Lambda execution role with basic Lambda execution policy
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
            { Key: "novaserve:version", Value: "2.0.0" },
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

    // Attach least-privilege inline policy from Nova IR
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
   * Fetch inline role policy document for an IAM role
   */
  async getRolePolicy(roleName: string, policyName: string): Promise<string | null> {
    try {
      const res = await awsRetry(() =>
        this.client.send(new GetRolePolicyCommand({ RoleName: roleName, PolicyName: policyName }))
      );
      return res.PolicyDocument ? decodeURIComponent(res.PolicyDocument) : null;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NoSuchEntityException") {
        return null;
      }
      throw err;
    }
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

    const newPolicyDoc = JSON.stringify({
      Version: "2012-10-17",
      Statement: statements,
    });

    // Check if live policy is identical to skip redundant API call
    const currentDoc = await this.getRolePolicy(roleName, policyName);
    if (currentDoc && currentDoc === newPolicyDoc) {
      return;
    }

    await awsRetry(() =>
      this.client.send(
        new PutRolePolicyCommand({
          RoleName: roleName,
          PolicyName: policyName,
          PolicyDocument: newPolicyDoc,
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
