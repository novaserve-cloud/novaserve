import { describe, it, expect } from "vitest";
import { NovaPlanner } from "./planner.js";
import type { NovaIRGraph } from "../ir/schema.js";

describe("NovaPlanner Immutable Property Strategy", () => {
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
    },
    permissions: [],
    outputs: {},
  };

  it("generates REPLACE action when an immutable attribute changes", () => {
    const activeState = {
      "db-users": {
        configHash: "hash-v0",
        config: { partitionKey: "user_id", engine: "dynamodb" },
      },
    };

    const plan = NovaPlanner.plan(baseIR, activeState, "aws");

    expect(plan.summary.replace).toBe(1);
    expect(plan.summary.update).toBe(0);
    const action = plan.actions.find((a) => a.resourceId === "db-users");
    expect(action?.action).toBe("replace");
    expect(action?.reason).toContain('Immutable attribute "partitionKey" changed');
  });

  it("generates UPDATE action when only mutable attributes change", () => {
    const activeState = {
      "db-users": {
        configHash: "hash-v0",
        config: { partitionKey: "id", engine: "dynamodb", billingMode: "PROVISIONED" },
      },
    };

    const updatedIR: NovaIRGraph = {
      ...baseIR,
      resources: {
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
    const action = plan.actions.find((a) => a.resourceId === "db-users");
    expect(action?.action).toBe("update");
  });
});
