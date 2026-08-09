import { describe, it, expect } from "vitest";
import { ProductionSafetyEngine, ProductionSafetyError } from "./safety.js";
import type { DeploymentPlan } from "../types/provider.js";

describe("ProductionSafetyEngine — 10/10 Guardrails & Secret Masking", () => {
  it("blocks deletion or replacement of protected resources", () => {
    const plan: DeploymentPlan = {
      appName: "prod-app",
      provider: "aws",
      environment: "production",
      actions: [
        {
          action: "delete",
          resource: {
            type: "database",
            name: "users-db",
            config: { deletionProtection: true },
            dependencies: [],
          },
          reason: "Database removal",
          dependsOn: [],
        },
      ],
      summary: { create: 0, update: 0, delete: 1, skip: 0 },
    };

    expect(() =>
      ProductionSafetyEngine.validatePlanSafety(plan, { environment: "production" })
    ).toThrow(ProductionSafetyError);

    // Override allowed with explicit forceDestroyProtectedResources option
    const result = ProductionSafetyEngine.validatePlanSafety(plan, {
      environment: "production",
      forceDestroyProtectedResources: true,
      allowDestructiveInProduction: true,
    });
    expect(result.valid).toBe(true);
  });

  it("blocks unapproved destructive actions in production environment", () => {
    const plan: DeploymentPlan = {
      appName: "prod-app",
      provider: "aws",
      environment: "production",
      actions: [
        {
          action: "replace",
          resource: {
            type: "function",
            name: "api",
            config: { memory: 1024 },
            dependencies: [],
          },
          reason: "Memory update replacement",
          dependsOn: [],
        },
      ],
      summary: { create: 0, update: 0, delete: 0, skip: 0 },
    };

    expect(() =>
      ProductionSafetyEngine.validatePlanSafety(plan, { environment: "production" })
    ).toThrow(/Destructive action "replace" on "api" blocked in production/);
  });

  it("recursively masks sensitive keys (passwords, tokens, keys) in data objects", () => {
    const rawData = {
      appName: "my-app",
      config: {
        apiUrl: "https://api.example.com",
        apiKey: "secret-key-12345",
        dbPassword: "super-secret-pass",
        authToken: "bearer-token-abc",
        nested: {
          privateSecret: "nested-secret-value",
          normalField: "public-value",
        },
      },
    };

    const masked = ProductionSafetyEngine.maskSecrets(rawData);

    expect(masked.config.apiUrl).toBe("https://api.example.com");
    expect(masked.config.apiKey).toBe("***MASKED***");
    expect(masked.config.dbPassword).toBe("***MASKED***");
    expect(masked.config.authToken).toBe("***MASKED***");
    expect(masked.config.nested.privateSecret).toBe("***MASKED***");
    expect(masked.config.nested.normalField).toBe("public-value");
  });
});
