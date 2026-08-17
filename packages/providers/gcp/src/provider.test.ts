import { describe, it, expect, vi } from "vitest";
import { GCPProvider } from "./provider.js";
import { GCPAuthManager } from "./utils/auth.js";
import { DeploymentPlan } from "novaserve-core";

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

describe("GCPProvider — 8+/10 Production Architecture", () => {
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

  it("validates resource compatibility", async () => {
    const provider = new GCPProvider();
    const validation = await provider.validate([
      { type: "function", name: "api", config: {}, dependencies: [] },
      { type: "storage", name: "uploads", config: {}, dependencies: [] },
      { type: "database", name: "db", config: { engine: "postgres" }, dependencies: [] },
      { type: "queue", name: "jobs", config: {}, dependencies: [] },
      { type: "cron", name: "cron", config: {}, dependencies: [] },
      { type: "cache", name: "redis", config: {}, dependencies: [] },
      { type: "secret", name: "secret", config: {}, dependencies: [] },
    ]);

    expect(validation.valid).toBe(true);
    // Cloud SQL supports postgres/mysql so no warning is strictly required here 
    // unless we mapped to a wrong engine, but it's valid.
  });

  it("processes deploy plan successfully", async () => {
    const provider = new GCPProvider();
    
    // Mock out services to prevent actual deployments
    (provider as any).functions = { createFunction: vi.fn().mockResolvedValue("func1") };
    (provider as any).storage = { createBucket: vi.fn().mockResolvedValue("gs://bucket1") };
    (provider as any).database = { createDatabase: vi.fn().mockResolvedValue("db1") };
    (provider as any).pubsub = { createTopic: vi.fn().mockResolvedValue("topic1") };
    (provider as any).iam = { assignRole: vi.fn() };

    const plan: DeploymentPlan = {
      appName: "test",
      provider: "gcp",
      environment: "prod",
      actions: [
        {
          action: "create",
          resource: { type: "function", name: "worker", config: {}, dependencies: ["storage-bucket"] },
          reason: "New",
          dependsOn: []
        },
        {
          action: "create",
          resource: { type: "storage", name: "bucket", config: {}, dependencies: [] },
          reason: "New",
          dependsOn: []
        }
      ],
      summary: { create: 2, update: 0, replace: 0, delete: 0, skip: 0 }
    };

    const result = await provider.deploy(plan);
    expect(result.success).toBe(true);
    expect(result.resources.length).toBe(2);
    
    // IAM role should be assigned because function has dependency on storage
    expect((provider as any).iam.assignRole).toHaveBeenCalledWith("storage");
  });
});
