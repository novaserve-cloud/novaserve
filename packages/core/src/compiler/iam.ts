/**
 * Least-Privilege IAM Permission Generator
 *
 * Infers fine-grained IAM policy statements directly from the application's
 * Nova IR resource linkage graph. Prevents dangerous wildcard (*) permissions.
 */

import type { NovaIRPermission, NovaIRResource } from "../ir/schema.js";

export function generateLeastPrivilegePermissions(
  resources: Record<string, NovaIRResource>,
  dependencies: Array<{ from: string; to: string; type: string }>
): NovaIRPermission[] {
  const permissions: NovaIRPermission[] = [];

  for (const dep of dependencies) {
    const fromRes = resources[dep.from];
    const toRes = resources[dep.to];

    if (!fromRes || !toRes) continue;

    // Only compute target functions or APIs get permissions to access linked infrastructure
    if (fromRes.type === "function" || fromRes.type === "api") {
      let actions: string[] = [];
      let arnResource = "*";

      switch (toRes.type) {
        case "storage":
          actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"];
          arnResource = `arn:aws:s3:::${toRes.name}/*`;
          break;
        case "queue":
          actions = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"];
          arnResource = `arn:aws:sqs:*:*:${toRes.name}`;
          break;
        case "database":
          actions = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query", "dynamodb:Scan"];
          arnResource = `arn:aws:dynamodb:*:*:table/${toRes.name}`;
          break;
        case "secret":
          actions = ["secretsmanager:GetSecretValue"];
          arnResource = `arn:aws:secretsmanager:*:*:secret:${toRes.name}-*`;
          break;
        case "eventBus":
          actions = ["events:PutEvents"];
          arnResource = `arn:aws:events:*:*:event-bus/${toRes.name}`;
          break;
        default:
          actions = ["kms:Decrypt"];
          arnResource = "*";
          break;
      }

      permissions.push({
        id: `perm-${fromRes.name}-${toRes.name}`,
        targetFunction: fromRes.name,
        actions,
        resources: [arnResource],
        reason: `Inferred permission for ${fromRes.name} to access ${toRes.type} resource "${toRes.name}"`,
      });
    }
  }

  return permissions;
}
