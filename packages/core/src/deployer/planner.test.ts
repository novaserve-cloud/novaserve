import { describe, it, expect } from "vitest";
import { NovaPlanner } from "./planner.js";
import type { NovaIRGraph } from "../ir/schema.js";

describe("NovaPlanner & Diff Engine", () => {
  const baseIR: NovaIRGraph = {
    version: "1.0.0",
    app: { name: "test-app", environment: "production", hash: "a".repeat(64) },
    resources: {
      "db-users": {
        name: "users",
        type: "database",
        config: { partitionKey: "id", engine: "dynamodb" },
        dependencies: [],
        configHash: "hash-v1",
      },
      "fn-hello": {
        name: "hello",
        type: "function",
        config: { memory: 256, timeout: 10 },
        dependencies: [],
        configHash: "hash-fn-v1",
      },
    },
    permissions: [],
    outputs: {},
  };

  it("generates CREATE actions for brand new resources", () => {
    const plan = NovaPlanner.plan(baseIR, {}, "aws");

    expect(plan.summary.create).toBe(2);
    expect(plan.summary.update).toBe(0);
    expect(plan.summary.replace).toBe(0);
    expect(plan.summary.delete).toBe(0);
    expect(plan.summary.skip).toBe(0);

    expect(plan.actions[0].action).toBe("create");
    expect(plan.actions[1].action).toBe("create");
    expect(plan.planHash).toHaveLength(64);
  });

  it("generates REPLACE action when an immutable attribute changes", () => {
    const activeState = {
      "db-users": {
        configHash: "hash-v0",
        config: { partitionKey: "user_id", engine: "dynamodb" },
      },
      "fn-hello": {
        configHash: "hash-fn-v1",
        config: { memory: 256, timeout: 10 },
      },
    };

    const plan = NovaPlanner.plan(baseIR, activeState, "aws");

    expect(plan.summary.replace).toBe(1);
    expect(plan.summary.skip).toBe(1);
    const replaceAction = plan.actions.find((a) => a.resourceId === "db-users");
    expect(replaceAction?.action).toBe("replace");
    expect(replaceAction?.reason).toContain('Immutable attribute "partitionKey" changed');
  });

  it("generates UPDATE action when only mutable attributes change", () => {
    const activeState = {
      "db-users": {
        configHash: "hash-v0",
        config: { partitionKey: "id", engine: "dynamodb", billingMode: "PROVISIONED" },
      },
      "fn-hello": {
        configHash: "hash-fn-v1",
        config: { memory: 256, timeout: 10 },
      },
    };

    const updatedIR: NovaIRGraph = {
      ...baseIR,
      resources: {
        ...baseIR.resources,
        "db-users": {
          ...baseIR.resources["db-users"],
          config: { partitionKey: "id", engine: "dynamodb", billingMode: "PAY_PER_REQUEST" },
          configHash: "hash-v2",
        },
      },
    };

    const plan = NovaPlanner.plan(updatedIR, activeState, "aws");

    expect(plan.summary.replace).toBe(0);
    expect(plan.summary.update).toBe(1);
    expect(plan.summary.skip).toBe(1);
    const updateAction = plan.actions.find((a) => a.resourceId === "db-users");
    expect(updateAction?.action).toBe("update");
    expect(updateAction?.diffs).toEqual([
      { attribute: "billingMode", oldValue: "PROVISIONED", newValue: "PAY_PER_REQUEST" },
    ]);
  });

  it("generates DELETE action when a resource is removed from Nova IR", () => {
    const activeState = {
      "db-users": {
        configHash: "hash-v1",
        config: { partitionKey: "id", engine: "dynamodb" },
      },
      "fn-hello": {
        configHash: "hash-fn-v1",
        config: { memory: 256, timeout: 10 },
      },
      "sqs-old": {
        configHash: "hash-sqs-v1",
        config: { visibilityTimeout: 30 },
      },
    };

    const plan = NovaPlanner.plan(baseIR, activeState, "aws");

    expect(plan.summary.delete).toBe(1);
    expect(plan.summary.skip).toBe(2);
    const deleteAction = plan.actions.find((a) => a.resourceId === "sqs-old");
    expect(deleteAction?.action).toBe("delete");
  });

  it("computes deterministic irHash and planHash", () => {
    const plan1 = NovaPlanner.plan(baseIR, {}, "aws");
    const plan2 = NovaPlanner.plan(baseIR, {}, "aws");

    expect(plan1.irHash).toBe(baseIR.app.hash);
    expect(plan1.planHash).toBe(plan2.planHash);
  });
});
