import { describe, it, expect, vi } from "vitest";
import { GCPProvider } from "./provider.js";
import { GCPAuthManager } from "./utils/auth.js";
import type { DeploymentPlan } from "novaserve-core";

// Mock the Auth manager to avoid real network calls in tests
vi.mock("./utils/auth.js", () => {
  return {
    GCPAuthManager: {
      getCredentials: vi.fn().mockResolvedValue({
        projectId: "test-gcp-project",
        region: "us-central1",
        auth: {},
      }),
      isConfigured: vi.fn().mockReturnValue(true),
    },
  };
});

describe("GCPProvider — Production Architecture", () => {
  // ── Auth & Status ──────────────────────────────────────

  it("resolves GCP credentials", async () => {
    const creds = await GCPAuthManager.getCredentials({});
    expect(creds.projectId).toBe("test-gcp-project");
    expect(creds.region).toBe("us-central1");
    expect(GCPAuthManager.isConfigured(creds)).toBe(true);
  });

  it("validates GCP provider status", async () => {
    const provider = new GCPProvider();
    await provider.init({ name: "test-app", resources: [], config: {} });

    const status = await provider.getStatus();
    expect(status.name).toBe("Google Cloud Platform");
    expect(status.region).toBe("us-central1");
    expect(status.configured).toBe(true);
  });

  // ── Validation: All 8 Resource Types ───────────────────

  it("validates all supported resource types", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "function", name: "api", config: {}, dependencies: [] },
      { type: "storage", name: "uploads", config: {}, dependencies: [] },
      { type: "database", name: "db", config: { engine: "postgres" }, dependencies: [] },
      { type: "queue", name: "jobs", config: {}, dependencies: [] },
      { type: "cron", name: "nightly", config: { schedule: "0 0 * * *" }, dependencies: [] },
      { type: "cache", name: "redis", config: {}, dependencies: [] },
      { type: "secret", name: "api-key", config: {}, dependencies: [] },
      { type: "api", name: "gateway", config: {}, dependencies: [] },
    ]);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("rejects unsupported resource types", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "websocket", name: "ws", config: {}, dependencies: [] },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(1);
    expect(validation.errors[0]!.message).toContain("not supported");
  });

  // ── Validation: Cloud Functions ─────────────────────────

  it("rejects invalid Cloud Functions memory", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "function", name: "fn1", config: { memory: 64 }, dependencies: [] },
      { type: "function", name: "fn2", config: { memory: 65536 }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(2);
    expect(validation.errors[0]!.message).toContain("128-32768 MB");
    expect(validation.errors[1]!.message).toContain("128-32768 MB");
  });

  it("rejects invalid Cloud Functions timeout", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "function", name: "fn", config: { timeout: 7200 }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]!.message).toContain("1-3600 seconds");
  });

  // ── Validation: Database ────────────────────────────────

  it("rejects unsupported database engines", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "database", name: "mongo", config: { engine: "mongodb" }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]!.message).toContain("not supported by GCP Cloud SQL");
  });

  it("rejects dynamodb engine on GCP", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "database", name: "dynamo", config: { engine: "dynamodb" }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]!.message).toContain("Firestore");
  });

  it("accepts MySQL engine", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "database", name: "mysql-db", config: { engine: "mysql" }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(true);
  });

  // ── Validation: Cron ────────────────────────────────────

  it("rejects invalid cron schedule format", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "cron", name: "bad-cron", config: { schedule: "invalid" }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]!.message).toContain("5-6 space-separated fields");
  });

  it("accepts valid cron schedule", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "cron", name: "good-cron", config: { schedule: "*/5 * * * *" }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(true);
  });

  // ── Validation: Cache ───────────────────────────────────

  it("rejects oversized Memorystore instances", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "cache", name: "huge", config: { memorySizeGb: 500 }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors[0]!.message).toContain("1-300 GB");
  });

  // ── Validation: Queue ───────────────────────────────────

  it("warns about out-of-range ack deadline", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "queue", name: "q", config: { ackDeadlineSeconds: 5 }, dependencies: [] },
    ]);

    expect(validation.valid).toBe(true); // warnings don't fail validation
    expect(validation.warnings).toHaveLength(1);
    expect(validation.warnings[0]!.message).toContain("10-600 seconds");
  });

  // ── Deploy: All 8 Resource Types ────────────────────────

  it("deploys all 8 resource types successfully", async () => {
    const provider = new GCPProvider();

    // Mock out services to prevent actual deployments
    (provider as any).functions = { createFunction: vi.fn().mockResolvedValue("func1"), deleteFunction: vi.fn() };
    (provider as any).storage = { createBucket: vi.fn().mockResolvedValue("gs://bucket1"), deleteBucket: vi.fn() };
    (provider as any).database = { createDatabase: vi.fn().mockResolvedValue("db1"), deleteDatabase: vi.fn() };
    (provider as any).pubsub = { createTopic: vi.fn().mockResolvedValue("topic1"), deleteTopic: vi.fn() };
    (provider as any).scheduler = { createJob: vi.fn().mockResolvedValue("job1"), deleteJob: vi.fn() };
    (provider as any).memorystore = { createInstance: vi.fn().mockResolvedValue("redis1"), deleteInstance: vi.fn() };
    (provider as any).secrets = { createSecret: vi.fn().mockResolvedValue("secret1"), deleteSecret: vi.fn() };
    (provider as any).apigateway = { createApi: vi.fn().mockResolvedValue("api1"), deleteApi: vi.fn() };
    (provider as any).iam = { assignRole: vi.fn() };
    (provider as any).initialized = true;
    (provider as any).projectId = "test-project";
    (provider as any).region = "us-central1";

    const plan: DeploymentPlan = {
      appName: "test",
      provider: "gcp",
      environment: "prod",
      actions: [
        { action: "create", resource: { type: "secret", name: "api-key", config: {}, dependencies: [] }, reason: "New", dependsOn: [] },
        { action: "create", resource: { type: "storage", name: "uploads", config: {}, dependencies: [] }, reason: "New", dependsOn: [] },
        { action: "create", resource: { type: "database", name: "db", config: { engine: "postgres" }, dependencies: [] }, reason: "New", dependsOn: [] },
        { action: "create", resource: { type: "queue", name: "jobs", config: {}, dependencies: [] }, reason: "New", dependsOn: [] },
        { action: "create", resource: { type: "cache", name: "redis", config: {}, dependencies: [] }, reason: "New", dependsOn: [] },
        { action: "create", resource: { type: "function", name: "worker", config: {}, dependencies: ["storage-uploads"] }, reason: "New", dependsOn: [] },
        { action: "create", resource: { type: "cron", name: "nightly", config: { schedule: "0 0 * * *" }, dependencies: [] }, reason: "New", dependsOn: [] },
        { action: "create", resource: { type: "api", name: "gateway", config: {}, dependencies: [] }, reason: "New", dependsOn: [] },
      ],
      summary: { create: 8, update: 0, replace: 0, delete: 0, skip: 0 },
    };

    const result = await provider.deploy(plan);
    expect(result.success).toBe(true);
    expect(result.resources).toHaveLength(8);
    expect(result.errors).toHaveLength(0);

    // Verify all services were called
    expect((provider as any).secrets.createSecret).toHaveBeenCalledWith("test-api-key");
    expect((provider as any).storage.createBucket).toHaveBeenCalledWith("test-uploads");
    expect((provider as any).database.createDatabase).toHaveBeenCalled();
    expect((provider as any).pubsub.createTopic).toHaveBeenCalledWith("test-jobs");
    expect((provider as any).memorystore.createInstance).toHaveBeenCalledWith("test-redis");
    expect((provider as any).functions.createFunction).toHaveBeenCalled();
    expect((provider as any).scheduler.createJob).toHaveBeenCalled();
    expect((provider as any).apigateway.createApi).toHaveBeenCalledWith("test-gateway");
  });

  // ── Deploy: IAM Role Assignment ─────────────────────────

  it("assigns IAM roles for function dependencies", async () => {
    const provider = new GCPProvider();

    (provider as any).functions = { createFunction: vi.fn().mockResolvedValue("func1") };
    (provider as any).storage = { createBucket: vi.fn().mockResolvedValue("gs://bucket1") };
    (provider as any).iam = { assignRole: vi.fn() };
    (provider as any).initialized = true;
    (provider as any).projectId = "test-project";
    (provider as any).region = "us-central1";

    const plan: DeploymentPlan = {
      appName: "test",
      provider: "gcp",
      environment: "prod",
      actions: [
        {
          action: "create",
          resource: { type: "function", name: "worker", config: {}, dependencies: ["storage-bucket", "queue-jobs"] },
          reason: "New",
          dependsOn: [],
        },
      ],
      summary: { create: 1, update: 0, replace: 0, delete: 0, skip: 0 },
    };

    const result = await provider.deploy(plan);
    expect(result.success).toBe(true);
    expect((provider as any).iam.assignRole).toHaveBeenCalledWith("storage");
    expect((provider as any).iam.assignRole).toHaveBeenCalledWith("queue");
  });

  // ── Deploy: Error Handling ──────────────────────────────

  it("handles deployment errors gracefully", async () => {
    const provider = new GCPProvider();

    (provider as any).functions = {
      createFunction: vi.fn().mockRejectedValue(new Error("Cloud Functions quota exceeded")),
    };
    (provider as any).iam = { assignRole: vi.fn() };
    (provider as any).initialized = true;
    (provider as any).projectId = "test-project";
    (provider as any).region = "us-central1";

    const plan: DeploymentPlan = {
      appName: "test",
      provider: "gcp",
      environment: "prod",
      actions: [
        {
          action: "create",
          resource: { type: "function", name: "failing-fn", config: {}, dependencies: [] },
          reason: "New",
          dependsOn: [],
        },
      ],
      summary: { create: 1, update: 0, replace: 0, delete: 0, skip: 0 },
    };

    const result = await provider.deploy(plan);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.error).toContain("Cloud Functions");
    expect(result.errors[0]!.error).toContain("quota exceeded");
    expect(result.errors[0]!.error).toContain("failing-fn");
  });

  it("redacts credentials from error messages", async () => {
    const provider = new GCPProvider();

    (provider as any).storage = {
      createBucket: vi.fn().mockRejectedValue(new Error("Auth failed: Bearer ya29.secrettoken123")),
    };
    (provider as any).initialized = true;
    (provider as any).projectId = "test-project";
    (provider as any).region = "us-central1";

    const plan: DeploymentPlan = {
      appName: "test",
      provider: "gcp",
      environment: "prod",
      actions: [
        {
          action: "create",
          resource: { type: "storage", name: "bucket", config: {}, dependencies: [] },
          reason: "New",
          dependsOn: [],
        },
      ],
      summary: { create: 1, update: 0, replace: 0, delete: 0, skip: 0 },
    };

    const result = await provider.deploy(plan);
    expect(result.success).toBe(false);
    expect(result.errors[0]!.error).not.toContain("ya29.secrettoken123");
    expect(result.errors[0]!.error).toContain("[REDACTED]");
  });

  // ── Deploy: Skip Actions ────────────────────────────────

  it("handles skip actions correctly", async () => {
    const provider = new GCPProvider();
    (provider as any).initialized = true;
    (provider as any).projectId = "test-project";
    (provider as any).region = "us-central1";

    const plan: DeploymentPlan = {
      appName: "test",
      provider: "gcp",
      environment: "prod",
      actions: [
        {
          action: "skip",
          resource: { type: "storage", name: "existing", config: {}, dependencies: [] },
          reason: "No changes",
          dependsOn: [],
        },
      ],
      summary: { create: 0, update: 0, replace: 0, delete: 0, skip: 1 },
    };

    const result = await provider.deploy(plan);
    expect(result.success).toBe(true);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]!.status).toBe("deployed");
  });

  // ── Destroy ─────────────────────────────────────────────

  it("destroys resources in reverse dependency order", async () => {
    const provider = new GCPProvider();
    const callOrder: string[] = [];

    (provider as any).functions = { deleteFunction: vi.fn(() => { callOrder.push("function"); }) };
    (provider as any).storage = { deleteBucket: vi.fn(() => { callOrder.push("storage"); }) };
    (provider as any).database = { deleteDatabase: vi.fn(() => { callOrder.push("database"); }) };
    (provider as any).pubsub = { deleteTopic: vi.fn(() => { callOrder.push("queue"); }) };
    (provider as any).scheduler = { deleteJob: vi.fn(() => { callOrder.push("cron"); }) };
    (provider as any).memorystore = { deleteInstance: vi.fn(() => { callOrder.push("cache"); }) };
    (provider as any).secrets = { deleteSecret: vi.fn(() => { callOrder.push("secret"); }) };
    (provider as any).apigateway = { deleteApi: vi.fn(() => { callOrder.push("api"); }) };
    (provider as any).initialized = true;

    await provider.destroy([
      { type: "function", name: "fn", config: {}, dependencies: [], id: "fn1", configHash: "", status: "deployed", outputs: {} },
      { type: "storage", name: "bucket", config: {}, dependencies: [], id: "s1", configHash: "", status: "deployed", outputs: {} },
      { type: "api", name: "gw", config: {}, dependencies: [], id: "a1", configHash: "", status: "deployed", outputs: {} },
      { type: "secret", name: "key", config: {}, dependencies: [], id: "sec1", configHash: "", status: "deployed", outputs: {} },
    ]);

    // API should be deleted before function, function before storage, storage before secret
    expect(callOrder.indexOf("api")).toBeLessThan(callOrder.indexOf("function"));
    expect(callOrder.indexOf("function")).toBeLessThan(callOrder.indexOf("storage"));
    expect(callOrder.indexOf("storage")).toBeLessThan(callOrder.indexOf("secret"));
  });
});
