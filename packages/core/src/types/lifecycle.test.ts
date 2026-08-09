import { describe, it, expect } from "vitest";
import { RESOURCE_CAPABILITY_MATRIX } from "./lifecycle.js";
import { NovaCompiler } from "../compiler/compiler.js";
import { NovaPlanner } from "../deployer/planner.js";

describe("Resource Capability Matrix & Update Strategy Engine — 10/10 Operations", () => {
  it("defines immutable attributes and default update strategies", () => {
    expect(RESOURCE_CAPABILITY_MATRIX.function.immutableAttributes).toContain("architecture");
    expect(RESOURCE_CAPABILITY_MATRIX.database.immutableAttributes).toContain("partitionKey");
    expect(RESOURCE_CAPABILITY_MATRIX.database.immutableAttributes).toContain("sortKey");
    expect(RESOURCE_CAPABILITY_MATRIX.queue.immutableAttributes).toContain("fifoQueue");
    expect(RESOURCE_CAPABILITY_MATRIX.storage.immutableAttributes).toContain("bucketName");

    expect(RESOURCE_CAPABILITY_MATRIX.database.defaultStrategy).toBe("create-before-destroy");
    expect(RESOURCE_CAPABILITY_MATRIX.function.defaultStrategy).toBe("in-place");
  });

  it("assigns blue/green create-before-destroy replacement and data loss warnings for database partition key changes", () => {
    const oldIR = NovaCompiler.compile({
      appName: "db-app",
      resources: [
        { type: "database", name: "users", config: { partitionKey: "id" }, dependencies: [] },
      ],
    }).ir;

    const newIR = NovaCompiler.compile({
      appName: "db-app",
      resources: [
        { type: "database", name: "users", config: { partitionKey: "tenantId" }, dependencies: [] },
      ],
    }).ir;

    const activeState = {
      "database-users": {
        configHash: oldIR.resources["database-users"].hash,
        config: oldIR.resources["database-users"].config,
      },
    };

    const plan = NovaPlanner.plan(newIR, activeState);
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].action).toBe("replace");
    expect(plan.actions[0].updateStrategy).toBe("create-before-destroy");
    expect(plan.actions[0].requiresDataMigration).toBe(true);
    expect(plan.actions[0].dataLossWarning).toContain("risks data loss");
  });

  it("supports create, update, replace, delete, observe across all resources", () => {
    for (const [type, cap] of Object.entries(RESOURCE_CAPABILITY_MATRIX)) {
      expect(cap.create).toBe(true);
      expect(cap.replace).toBe(true);
      expect(cap.delete).toBe(true);
      expect(cap.observe).toBe(true);
      expect(cap.defaultStrategy).toBeDefined();
    }
  });
});
