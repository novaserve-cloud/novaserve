import { describe, it, expect } from "vitest";
import { DependencyGraph } from "./dependency.js";
import type { Resource } from "../types/resources.js";

describe("DependencyGraph", () => {
  it("resolves parallel execution groups correctly", () => {
    const r1: Resource = { name: "db", type: "database", dependencies: [] };
    const r2: Resource = { name: "bucket", type: "storage", dependencies: [] };
    const r3: Resource = { name: "api", type: "api", dependencies: ["database-db", "storage-bucket"] };

    const graph = new DependencyGraph();
    graph.build([r1, r2, r3]);

    expect(graph.size).toBe(3);
    const groups = graph.getParallelGroups();
    expect(groups.length).toBe(2);
    expect(groups[0].map((r) => r.name)).toEqual(["db", "bucket"]);
    expect(groups[1].map((r) => r.name)).toEqual(["api"]);
  });

  it("detects circular dependencies", () => {
    const r1: Resource = { name: "nodeA", type: "fn", dependencies: ["fn-nodeB"] };
    const r2: Resource = { name: "nodeB", type: "fn", dependencies: ["fn-nodeA"] };

    const graph = new DependencyGraph();
    expect(() => graph.build([r1, r2])).toThrow(/Circular dependency detected/);
  });
});
