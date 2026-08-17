import { describe, it, expect } from "vitest";
import { KubernetesProvider } from "../src/provider.js";
import type { Resource } from "novaserve-core";

describe("KubernetesProvider", () => {
  it("should generate plan with create actions for new resources", async () => {
    const provider = new KubernetesProvider();
    await provider.init({ name: "test-app" });

    const resources: Resource[] = [
      {
        type: "api",
        name: "my-api",
        config: {},
        dependencies: [],
      },
    ];

    const plan = await provider.plan(resources, []);

    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].action).toBe("create");
    expect(plan.actions[0].resource.name).toBe("my-api");
  });

  it("should warn about unsupported types during validation", async () => {
    const provider = new KubernetesProvider();
    
    const result = await provider.validate([
      { type: "cdn", name: "my-cdn", config: {}, dependencies: [] }
    ]);

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].resource).toBe("my-cdn");
  });
});
