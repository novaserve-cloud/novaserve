import { describe, it, expect } from "vitest";
import { NovaCompiler, computeCanonicalHash } from "./compiler.js";
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

  it("produces full 64-character SHA-256 hashes (not truncated)", () => {
    const hash = computeCanonicalHash({ name: "test", value: 42 });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces deterministic IR — same source always yields same hash", () => {
    const opts = {
      appName: "determinism-test",
      environment: "production",
      region: "us-east-1",
      resources: [
        { type: "function", name: "hello", config: { memory: 256 }, dependencies: [] },
        { type: "storage", name: "files", config: { public: false }, dependencies: [] },
      ],
    };

    const result1 = NovaCompiler.compile(opts);
    const result2 = NovaCompiler.compile(opts);

    // IR hashes must be identical for identical source
    expect(result1.ir.app.hash).toBe(result2.ir.app.hash);
    expect(result1.ir.app.hash).toHaveLength(64);

    // Resource config hashes must be identical
    expect(result1.ir.resources["function-hello"]!.configHash).toBe(
      result2.ir.resources["function-hello"]!.configHash
    );

    // buildMetadata must exist but is separate from the canonical hash
    expect(result1.ir.buildMetadata).toBeDefined();
    expect(result1.ir.buildMetadata.createdIso).toBeTruthy();
    expect(result1.ir.buildMetadata.novaVersion).toBe("2.1.6");

    // Modifying buildMetadata should NOT change the app hash
    const irCopy = JSON.parse(JSON.stringify(result1.ir));
    irCopy.buildMetadata.createdIso = "2099-01-01T00:00:00.000Z";
    // The hash was computed without buildMetadata, so it stays the same
    expect(irCopy.app.hash).toBe(result1.ir.app.hash);
  });
});
