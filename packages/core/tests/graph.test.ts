import { describe, it, expect } from "vitest";
import { DependencyGraph } from "../src/graph/dependency.js";
import { TopologicalResolver } from "../src/graph/resolver.js";
import type { Resource } from "../src/types/resources.js";

describe("DependencyGraph and TopologicalResolver", () => {
  it("builds a DAG and resolves nodes in correct topological dependency order", () => {
    const resources: Resource[] = [
      {
        type: "function",
        name: "apiHandler",
        config: {},
        dependencies: ["storage-uploads", "database-mainDb"],
      },
      {
        type: "storage",
        name: "uploads",
        config: {},
        dependencies: [],
      },
      {
        type: "database",
        name: "mainDb",
        config: {},
        dependencies: [],
      },
    ];

    const resolver = new TopologicalResolver();
    const order = resolver.resolveFlat(resources);

    expect(order).toBeDefined();
    expect(order.length).toBe(3);

    const uploadsIdx = order.findIndex((r) => r.name === "uploads");
    const mainDbIdx = order.findIndex((r) => r.name === "mainDb");
    const apiHandlerIdx = order.findIndex((r) => r.name === "apiHandler");

    expect(uploadsIdx).toBeLessThan(apiHandlerIdx);
    expect(mainDbIdx).toBeLessThan(apiHandlerIdx);
  });

  it("identifies parallel execution tiers for independent resources", () => {
    const resources: Resource[] = [
      { type: "storage", name: "assets", config: {}, dependencies: [] },
      { type: "queue", name: "jobs", config: {}, dependencies: [] },
      { type: "function", name: "worker", config: {}, dependencies: ["queue-jobs"] },
    ];

    const resolver = new TopologicalResolver();
    const tiers = resolver.resolve(resources);

    expect(tiers.length).toBeGreaterThanOrEqual(2);
    // Tier 0 should contain independent resources
    const tier0Names = tiers[0].map((r) => r.name);
    expect(tier0Names).toContain("assets");
    expect(tier0Names).toContain("jobs");
    // Subsequent tier contains worker
    const tier1Names = tiers[1].map((r) => r.name);
    expect(tier1Names).toContain("worker");
  });

  it("throws an error when a cyclic dependency is present", () => {
    const cyclicResources: Resource[] = [
      { type: "function", name: "nodeA", config: {}, dependencies: ["function-nodeB"] },
      { type: "function", name: "nodeB", config: {}, dependencies: ["function-nodeA"] },
    ];

    const resolver = new TopologicalResolver();
    expect(() => resolver.resolveFlat(cyclicResources)).toThrow();
  });
});
