import { describe, it, expect } from "vitest";
import { AzureProvider } from "./provider.js";
import { isAzureRetriableError } from "./utils/retry.js";
import { AZURE_BUILTIN_ROLES } from "./services/identity.js";

describe("Azure Provider & Multi-Cloud Engine", () => {
  it("initializes AzureProvider with correct displayName and name", () => {
    const provider = new AzureProvider({ subscriptionId: "sub-123", location: "eastus" });
    expect(provider.name).toBe("azure");
    expect(provider.displayName).toBe("Microsoft Azure");
  });

  it("validates resource names according to Azure naming conventions", async () => {
    const provider = new AzureProvider();
    const result = await provider.validate([
      { type: "function", name: "ab", config: {}, dependencies: [] }, // too short
      { type: "storage", name: "valid-storage", config: {}, dependencies: [] },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toContain("too short");
  });

  it("defines standard Azure RBAC role definition GUIDs", () => {
    expect(AZURE_BUILTIN_ROLES.StorageBlobDataContributor).toBe("ba92f5b4-2d11-453d-a403-e96b0029c9fe");
    expect(AZURE_BUILTIN_ROLES.StorageQueueDataContributor).toBe("97474396-4610-4084-997b-c6ac88239438");
    expect(AZURE_BUILTIN_ROLES.CosmosDBDataContributor).toBe("00000000-0000-0000-0000-000000000002");
  });

  it("classifies Azure ARM 429 rate limit and 5xx errors as retriable", () => {
    expect(isAzureRetriableError({ statusCode: 429 })).toBe(true);
    expect(isAzureRetriableError({ statusCode: 500 })).toBe(true);
    expect(isAzureRetriableError({ code: "RoleAssignmentExists" })).toBe(true);
    expect(isAzureRetriableError({ code: "AuthorizationFailed" })).toBe(false);
  });
});
