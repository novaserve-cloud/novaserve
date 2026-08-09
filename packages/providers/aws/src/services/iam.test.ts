import { describe, it, expect } from "vitest";
import { IAMService } from "./iam.js";

describe("AWS IAM Service — 10/10 Lifecycle & Policy Engine", () => {
  it("synthesizes least-privilege IAM permissions for S3 storage dependencies", () => {
    const iam = new IAMService("us-east-1");
    const perms = iam.synthesizeGraphPermissions(
      ["uploads"],
      [{ type: "storage", name: "uploads" }],
      "my-app",
      "us-east-1"
    );

    expect(perms.length).toBe(1);
    expect(perms[0].actions).toContain("s3:GetObject");
    expect(perms[0].actions).toContain("s3:PutObject");
    expect(perms[0].resources).toContain("arn:aws:s3:::my-app-uploads/*");
    expect(perms[0].resources).toContain("arn:aws:s3:::my-app-uploads");
  });

  it("synthesizes least-privilege IAM permissions for SQS queue dependencies", () => {
    const iam = new IAMService("us-east-1");
    const perms = iam.synthesizeGraphPermissions(
      ["jobs"],
      [{ type: "queue", name: "jobs" }],
      "my-app",
      "us-east-1",
      "123456789012"
    );

    expect(perms.length).toBe(1);
    expect(perms[0].actions).toContain("sqs:SendMessage");
    expect(perms[0].actions).toContain("sqs:ReceiveMessage");
    expect(perms[0].resources).toContain("arn:aws:sqs:us-east-1:123456789012:my-app-jobs");
  });

  it("synthesizes least-privilege IAM permissions for DynamoDB database dependencies", () => {
    const iam = new IAMService("us-east-1");
    const perms = iam.synthesizeGraphPermissions(
      ["users-db"],
      [{ type: "database", name: "users-db" }],
      "my-app",
      "us-east-1",
      "123456789012"
    );

    expect(perms.length).toBe(1);
    expect(perms[0].actions).toContain("dynamodb:GetItem");
    expect(perms[0].actions).toContain("dynamodb:PutItem");
    expect(perms[0].actions).toContain("dynamodb:Query");
    expect(perms[0].resources).toContain("arn:aws:dynamodb:us-east-1:123456789012:table/my-app-users-db");
  });
});
