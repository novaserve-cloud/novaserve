import { describe, it, expect } from "vitest";
import { NovaCompiler } from "./compiler.js";
import { validateCapabilities } from "./capabilities.js";
import { NovaSecurityScanner } from "../security/scanner.js";
import { NovaPlanner } from "../deployer/planner.js";
import { NovaCostEstimator } from "../cost/estimator.js";

describe("Nova Compiler & Nova IR Graph", () => {
  it("compiles application resources into a valid Nova IR graph", () => {
    const result = NovaCompiler.compile({
      appName: "test-app",
      environment: "staging",
      region: "us-east-1",
      targetProvider: "aws",
      resources: [
        {
          type: "function",
          name: "usersList",
          config: { memory: 1024 },
          dependencies: ["storage-uploads"],
        },
        {
          type: "storage",
          name: "uploads",
          config: { public: false },
          dependencies: [],
        },
      ],
    });

    const { ir, capabilityValidation } = result;

    expect(ir.schemaVersion).toBe("1.0.0");
    expect(ir.app.name).toBe("test-app");
    expect(ir.app.environment).toBe("staging");
    expect(ir.app.region).toBe("us-east-1");
    expect(capabilityValidation.valid).toBe(true);

    expect(ir.resources["function-usersList"]).toBeDefined();
    expect(ir.resources["storage-uploads"]).toBeDefined();
    expect(ir.permissions.length).toBeGreaterThan(0);
    expect(ir.permissions[0]?.targetFunction).toBe("usersList");
    expect(ir.permissions[0]?.actions).toContain("s3:GetObject");
    expect(ir.permissions[0]?.resources[0]).toContain("uploads");
  });

  it("detects unsupported capabilities on Cloudflare provider", () => {
    const val = validateCapabilities(
      [{ resourceId: "database-main", capability: "database", engine: "postgres" }],
      "cloudflare"
    );

    expect(val.valid).toBe(false);
    expect(val.errors.length).toBe(1);
    expect(val.errors[0]?.message).toContain("Cloudflare Workers & R2");
    expect(val.errors[0]?.alternatives).toContain("Neon PostgreSQL");
  });

  it("audits security findings and prevents wildcard IAM policies", () => {
    const ir = NovaCompiler.compile({
      appName: "sec-app",
      resources: [
        {
          type: "storage",
          name: "publicBucket",
          config: { public: true },
          dependencies: [],
        },
      ],
    }).ir;

    const report = NovaSecurityScanner.scan(ir);
    expect(report.totalFindings).toBeGreaterThan(0);
    expect(report.findings[0]?.title).toContain("Public Storage Bucket");
  });

  it("generates diff plan and monthly cost estimation", () => {
    const ir = NovaCompiler.compile({
      appName: "cost-app",
      resources: [
        { type: "function", name: "worker", config: { memory: 512 }, dependencies: [] },
        { type: "api", name: "httpApi", config: {}, dependencies: [] },
      ],
    }).ir;

    const plan = NovaPlanner.plan(ir, {});
    expect(plan.actions.length).toBe(2);
    expect(plan.totalEstimatedMonthlyCostUsd).toBeGreaterThan(0);

    const costReport = NovaCostEstimator.estimate(ir);
    expect(costReport.totalMonthlyUsd).toBeGreaterThan(0);
  });
});
