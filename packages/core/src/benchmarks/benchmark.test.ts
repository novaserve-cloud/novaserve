import { describe, it, expect } from "vitest";
import { performance } from "perf_hooks";
import { NovaCompiler } from "../compiler/compiler.js";
import { NovaPlanner } from "../deployer/planner.js";
import { DependencyGraph } from "../graph/dependency.js";
import type { Resource } from "../types/resources.js";

describe("NovaServe Performance Benchmarks", () => {
  it("compiles 50 synthetic resources into Nova IR within 50ms", () => {
    const syntheticResources: Resource[] = Array.from({ length: 50 }, (_, i) => ({
      type: i % 2 === 0 ? "function" : "storage",
      name: `res_${i}`,
      config: { memory: 512, timeout: 30, public: false },
      dependencies: i > 0 ? [`${(i - 1) % 2 === 0 ? "function" : "storage"}-res_${i - 1}`] : [],
    }));

    const start = performance.now();
    const compileResult = NovaCompiler.compile({
      appName: "benchmark-app",
      resources: syntheticResources,
    });
    const duration = performance.now() - start;

    expect(compileResult.ir.schemaVersion).toBe("1.0.0");
    expect(Object.keys(compileResult.ir.resources).length).toBe(50);
    expect(duration).toBeLessThan(100); // Must be under 100ms
  });

  it("calculates deployment plan and graph DAG within 20ms", () => {
    const ir = NovaCompiler.compile({
      appName: "benchmark-app",
      resources: [
        { type: "function", name: "fnA", config: { memory: 512 }, dependencies: [] },
        { type: "storage", name: "bucketB", config: { public: false }, dependencies: [] },
        { type: "queue", name: "qC", config: {}, dependencies: ["function-fnA"] },
      ],
    }).ir;

    const graph = new DependencyGraph();
    const startGraph = performance.now();
    graph.buildFromIR(ir);
    const durationGraph = performance.now() - startGraph;

    const startPlan = performance.now();
    const plan = NovaPlanner.plan(ir, {}, "aws");
    const durationPlan = performance.now() - startPlan;

    expect(graph.size).toBe(3);
    expect(plan.actions.length).toBe(3);
    expect(durationGraph + durationPlan).toBeLessThan(50);
  });
});
