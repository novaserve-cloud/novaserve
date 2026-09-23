import { describe, it, expect } from "vitest";
import { NovaPlanner } from "../src/deployer/planner.js";
import { NovaCompiler } from "../src/compiler/compiler.js";
import type { Resource } from "../src/types/resources.js";

describe("NovaPlanner", () => {
  it("generates 'create' actions for resources missing from active state", () => {
    const resources: Resource[] = [
      { type: "function", name: "authHandler", config: { memory: 256 }, dependencies: [] },
      { type: "storage", name: "avatars", config: {}, dependencies: [] },
    ];

    const { ir } = NovaCompiler.compile({ appName: "test-app", resources });
    const plan = NovaPlanner.plan(ir, {});

    expect(plan.summary.create).toBe(2);
    expect(plan.summary.update).toBe(0);
    expect(plan.summary.delete).toBe(0);
    expect(plan.summary.skip).toBe(0);

    const createActions = plan.actions.filter((a) => a.action === "create");
    expect(createActions.map((a) => a.name)).toEqual(["authHandler", "avatars"]);
    expect(plan.totalEstimatedSeconds).toBeGreaterThan(0);
  });

  it("generates 'skip' action when resource config hash is identical", () => {
    const resources: Resource[] = [
      { type: "function", name: "ping", config: { timeout: 10 }, dependencies: [] },
    ];

    const { ir } = NovaCompiler.compile({ appName: "test-app", resources });
    const resId = "function-ping";
    const activeState = {
      [resId]: {
        configHash: ir.resources[resId].configHash,
        config: { timeout: 10 },
      },
    };

    const plan = NovaPlanner.plan(ir, activeState);
    expect(plan.summary.create).toBe(0);
    expect(plan.summary.skip).toBe(1);
    expect(plan.actions[0].action).toBe("skip");
    expect(plan.actions[0].reason).toBe("Config unchanged");
  });

  it("generates 'update' action when resource configuration changes", () => {
    const resources: Resource[] = [
      { type: "function", name: "resize", config: { memory: 512 }, dependencies: [] },
    ];

    const { ir } = NovaCompiler.compile({ appName: "test-app", resources });
    const resId = "function-resize";
    const activeState = {
      [resId]: {
        configHash: "older-hash-value-12345",
        config: { memory: 256 },
      },
    };

    const plan = NovaPlanner.plan(ir, activeState);
    expect(plan.summary.update).toBe(1);
    expect(plan.actions[0].action).toBe("update");
    expect(plan.actions[0].diffs).toBeDefined();
    expect(plan.actions[0].diffs?.[0].attribute).toBe("memory");
    expect(plan.actions[0].diffs?.[0].oldValue).toBe(256);
    expect(plan.actions[0].diffs?.[0].newValue).toBe(512);
  });

  it("generates 'delete' action when resource exists in active state but not in new IR", () => {
    const resources: Resource[] = [];
    const { ir } = NovaCompiler.compile({ appName: "test-app", resources });

    const activeState = {
      "function-deprecatedFn": {
        configHash: "hash-001",
        config: {},
      },
    };

    const plan = NovaPlanner.plan(ir, activeState);
    expect(plan.summary.delete).toBe(1);
    expect(plan.actions[0].action).toBe("delete");
    expect(plan.actions[0].name).toBe("deprecatedFn");
  });
});
