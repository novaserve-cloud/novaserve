import { describe, it, expect } from "vitest";
import { AzureProvider } from "../src/provider.js";
import { AzureMapper } from "../src/mapper.js";
import { isAzureRetriableError } from "../src/utils/retry.js";
import { AZURE_BUILTIN_ROLES } from "../src/services/identity.js";
import { buildNovaServeTags } from "../src/types.js";
import type { NovaIRGraph } from "novaserve-core";

// ── Provider Initialization ──────────────────────────────────

describe("AzureProvider", () => {
  it("initializes with correct name and displayName", () => {
    const provider = new AzureProvider({ subscriptionId: "sub-123", location: "eastus" });
    expect(provider.name).toBe("azure");
    expect(provider.displayName).toBe("Microsoft Azure");
  });

  it("validates resource names according to Azure naming conventions", async () => {
    const provider = new AzureProvider();
    const result = await provider.validate([
      { type: "function", name: "ab", config: {}, dependencies: [] }, // too short
      { type: "storage", name: "valid-storage", config: {}, dependencies: [] },
      { type: "cache", name: "valid-cache", config: {}, dependencies: [] },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain("too short");
  });

  it("validates resources with only valid names", async () => {
    const provider = new AzureProvider();
    const result = await provider.validate([
      { type: "function", name: "my-func", config: {}, dependencies: [] },
      { type: "storage", name: "uploads", config: {}, dependencies: [] },
      { type: "secret", name: "api-key", config: {}, dependencies: [] },
      { type: "cron", name: "cleanup", config: {}, dependencies: [] },
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});

// ── Retry Engine ─────────────────────────────────────────────

describe("Azure Retry Engine", () => {
  it("classifies Azure ARM 429 rate limit and 5xx errors as retriable", () => {
    expect(isAzureRetriableError({ statusCode: 429 })).toBe(true);
    expect(isAzureRetriableError({ statusCode: 500 })).toBe(true);
    expect(isAzureRetriableError({ statusCode: 503 })).toBe(true);
    expect(isAzureRetriableError({ code: "RoleAssignmentExists" })).toBe(true);
    expect(isAzureRetriableError(new Error("socket hang up"))).toBe(true);
  });

  it("does not retry authorization or template errors", () => {
    expect(isAzureRetriableError({ code: "AuthorizationFailed" })).toBe(false);
    expect(isAzureRetriableError({ code: "InvalidTemplateDeployment" })).toBe(false);
    expect(isAzureRetriableError({ statusCode: 400 })).toBe(false);
  });
});

// ── RBAC Roles ───────────────────────────────────────────────

describe("Azure RBAC Role Definitions", () => {
  it("defines standard Azure RBAC role definition GUIDs", () => {
    expect(AZURE_BUILTIN_ROLES.StorageBlobDataContributor).toBe("ba92f5b4-2d11-453d-a403-e96b0029c9fe");
    expect(AZURE_BUILTIN_ROLES.StorageQueueDataContributor).toBe("97474396-4610-4084-997b-c6ac88239438");
    expect(AZURE_BUILTIN_ROLES.CosmosDBDataContributor).toBe("00000000-0000-0000-0000-000000000002");
    expect(AZURE_BUILTIN_ROLES.StorageBlobDataReader).toBe("2a2b9908-6ea1-4ae2-8e65-a410df84e7d1");
    expect(AZURE_BUILTIN_ROLES.ServiceBusDataSender).toBe("69af8202-86e0-4e8b-8a4d-77636b1b0928");
  });
});

// ── NovaServe Tags ───────────────────────────────────────────

describe("Azure Resource Tags", () => {
  it("builds standard NovaServe-managed tags", () => {
    const tags = buildNovaServeTags("my-app", "production", "user-uploads");

    expect(tags["novaserve-managed"]).toBe("true");
    expect(tags["novaserve-application"]).toBe("my-app");
    expect(tags["novaserve-environment"]).toBe("production");
    expect(tags["novaserve-resource"]).toBe("user-uploads");
    expect(tags["novaserve-version"]).toBe("2.0.0");
  });
});

// ── Azure Mapper ─────────────────────────────────────────────

describe("AzureMapper", () => {
  const mockIR: NovaIRGraph = {
    schemaVersion: "1.0.0",
    app: {
      name: "test-app",
      version: "1.0.0",
      environment: "production",
      region: "eastus",
      hash: "abc123",
    },
    resources: {
      "function-api": {
        id: "function-api",
        type: "function",
        name: "api-handler",
        configHash: "hash1",
        config: { handler: "src/handlers/api.handler", runtime: "node20" },
        dependencies: ["storage-uploads"],
        requiredCapabilities: ["compute"],
      },
      "storage-uploads": {
        id: "storage-uploads",
        type: "storage",
        name: "user-uploads",
        configHash: "hash2",
        config: { maxSize: "10mb" },
        dependencies: [],
        requiredCapabilities: ["storage"],
      },
      "secret-stripe": {
        id: "secret-stripe",
        type: "secret",
        name: "STRIPE_KEY",
        configHash: "hash3",
        config: { value: "sk_test_..." },
        dependencies: [],
        requiredCapabilities: ["secrets"],
      },
      "cache-sessions": {
        id: "cache-sessions",
        type: "cache",
        name: "session-cache",
        configHash: "hash4",
        config: { sku: "Standard", capacity: 1 },
        dependencies: [],
        requiredCapabilities: ["cache"],
      },
      "cron-cleanup": {
        id: "cron-cleanup",
        type: "cron",
        name: "daily-cleanup",
        configHash: "hash5",
        config: { schedule: "0 0 * * *", handler: "src/handlers/cleanup.run" },
        dependencies: [],
        requiredCapabilities: ["cron"],
      },
      "event-notifications": {
        id: "event-notifications",
        type: "eventBus",
        name: "notifications",
        configHash: "hash6",
        config: {},
        dependencies: [],
        requiredCapabilities: ["events"],
      },
    },
    dependencies: [
      { from: "function-api", to: "storage-uploads", type: "permission" },
    ],
    capabilitiesRequired: ["compute", "storage", "secrets", "cache", "cron", "events"],
    permissions: [
      {
        id: "perm-1",
        targetFunction: "function-api",
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: ["storage-uploads"],
        reason: "API handler needs to read/write user uploads",
      },
    ],
    outputs: {},
    buildMetadata: {
      createdIso: new Date().toISOString(),
      novaVersion: "2.0.0",
    },
  };

  const mockContext = {
    appName: "test-app",
    environment: "production",
    resourceGroup: "test-app-production-rg",
    location: "eastus",
    tags: buildNovaServeTags("test-app", "production", "test-app"),
  };

  it("maps all Nova IR resource types to Azure resources", () => {
    const plan = AzureMapper.mapIRToAzureResources(mockIR, mockContext);

    expect(plan.resources).toHaveLength(6);
    expect(plan.context.appName).toBe("test-app");
  });

  it("orders resources by dependency (infrastructure before compute)", () => {
    const plan = AzureMapper.mapIRToAzureResources(mockIR, mockContext);
    const types = plan.resources.map((r) => r.type);

    // Secrets and storage should come before functions
    const secretIdx = types.indexOf("secret");
    const storageIdx = types.indexOf("storage");
    const functionIdx = types.indexOf("function");

    expect(secretIdx).toBeLessThan(functionIdx);
    expect(storageIdx).toBeLessThan(functionIdx);
  });

  it("generates RBAC bindings from IR permissions", () => {
    const plan = AzureMapper.mapIRToAzureResources(mockIR, mockContext);

    expect(plan.rbacBindings.length).toBeGreaterThanOrEqual(1);
    const storageBinding = plan.rbacBindings.find(
      (b) => b.targetResourceId === "storage-uploads"
    );
    expect(storageBinding).toBeDefined();
    expect(storageBinding?.roleDefinitionId).toBe("ba92f5b4-2d11-453d-a403-e96b0029c9fe"); // StorageBlobDataContributor
  });

  it("maps secret resources to Key Vault configuration", () => {
    const plan = AzureMapper.mapIRToAzureResources(mockIR, mockContext);
    const secretRes = plan.resources.find((r) => r.type === "secret");

    expect(secretRes).toBeDefined();
    expect(secretRes?.azureName).toContain("-kv");
    expect((secretRes?.serviceConfig as any).secretName).toBe("STRIPE_KEY");
  });

  it("maps cache resources to Azure Redis configuration", () => {
    const plan = AzureMapper.mapIRToAzureResources(mockIR, mockContext);
    const cacheRes = plan.resources.find((r) => r.type === "cache");

    expect(cacheRes).toBeDefined();
    expect(cacheRes?.azureName).toContain("test-app-session-cache");
    expect((cacheRes?.serviceConfig as any).sku).toBe("Standard");
  });

  it("maps cron resources to Azure Scheduler configuration", () => {
    const plan = AzureMapper.mapIRToAzureResources(mockIR, mockContext);
    const cronRes = plan.resources.find((r) => r.type === "cron");

    expect(cronRes).toBeDefined();
    expect(cronRes?.azureName).toContain("cron");
    expect((cronRes?.serviceConfig as any).schedule).toBe("0 0 * * *");
    expect((cronRes?.serviceConfig as any).handler).toBe("src/handlers/cleanup.run");
  });

  it("maps eventBus resources to Azure Event Grid configuration", () => {
    const plan = AzureMapper.mapIRToAzureResources(mockIR, mockContext);
    const eventRes = plan.resources.find((r) => r.type === "eventBus");

    expect(eventRes).toBeDefined();
    expect(eventRes?.azureName).toContain("notifications");
    expect((eventRes?.serviceConfig as any).topicName).toBe("notifications");
  });
});
