import { describe, it, expect } from "vitest";
import { DependencyGraph } from "./dependency.js";
import type { Resource } from "../types/resources.js";

describe("DependencyGraph", () => {
  it("resolves parallel execution groups correctly", () => {
    const r1: Resource = { name: "db", type: "database", config: {}, dependencies: [] };
    const r2: Resource = { name: "bucket", type: "storage", config: {}, dependencies: [] };
    const r3: Resource = { name: "api", type: "api", config: {}, dependencies: ["database-db", "storage-bucket"] };

    const graph = new DependencyGraph();
    graph.build([r1, r2, r3]);

    expect(graph.size).toBe(3);
    const groups = graph.getParallelGroups();
    expect(groups.length).toBe(2);
    expect(groups[0]!.map((r) => r.name)).toEqual(["db", "bucket"]);
    expect(groups[1]!.map((r) => r.name)).toEqual(["api"]);
  });

  it("detects circular dependencies", () => {
    const r1: Resource = { name: "nodeA", type: "function", config: {}, dependencies: ["function-nodeB"] };
    const r2: Resource = { name: "nodeB", type: "function", config: {}, dependencies: ["function-nodeA"] };

    const graph = new DependencyGraph();
    expect(() => graph.build([r1, r2])).toThrow(/Circular dependency detected/);
  });

  it("correctly calculates depths in a diamond dependency graph", () => {
    // Diamond: A → B → D, A → C → D
    // A has depth 0, B and C have depth 1, D has depth 2 (NOT 3!)
    const rA: Resource = { name: "A", type: "function", config: {}, dependencies: [] };
    const rB: Resource = { name: "B", type: "function", config: {}, dependencies: ["function-A"] };
    const rC: Resource = { name: "C", type: "function", config: {}, dependencies: ["function-A"] };
    const rD: Resource = { name: "D", type: "function", config: {}, dependencies: ["function-B", "function-C"] };

    const graph = new DependencyGraph();
    graph.build([rA, rB, rC, rD]);

    const groups = graph.getParallelGroups();

    // Depth 0: A
    expect(groups[0]!.map((r) => r.name)).toEqual(["A"]);
    // Depth 1: B and C (parallel)
    expect(groups[1]!.map((r) => r.name).sort()).toEqual(["B", "C"]);
    // Depth 2: D (NOT depth 3 — diamond must not double-count)
    expect(groups[2]!.map((r) => r.name)).toEqual(["D"]);
    // Total: exactly 3 levels, not 4
    expect(groups.length).toBe(3);
  });

  it("handles a deep linear chain", () => {
    // A → B → C → D (all sequential)
    const rA: Resource = { name: "a", type: "storage", config: {}, dependencies: [] };
    const rB: Resource = { name: "b", type: "database", config: {}, dependencies: ["storage-a"] };
    const rC: Resource = { name: "c", type: "queue", config: {}, dependencies: ["database-b"] };
    const rD: Resource = { name: "d", type: "function", config: {}, dependencies: ["queue-c"] };

    const graph = new DependencyGraph();
    graph.build([rA, rB, rC, rD]);

    const order = graph.getTopologicalOrder();
    expect(order.map((r) => r.name)).toEqual(["a", "b", "c", "d"]);
    expect(graph.getParallelGroups().length).toBe(4);
  });
});
