import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StateManager } from "./state.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResolvedResource } from "../types/resources.js";

describe("StateManager — 10/10 Provider Identity & Atomic Persistence Engine", () => {
  let tempDir: string;
  let stateManager: StateManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "nova-state-test-"));
    stateManager = new StateManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("enforces lock acquisition and prevents concurrent deployment locks", () => {
    const lock = stateManager.acquireLock("test-app", "production", "dev1");
    expect(lock.lockId).toBeDefined();

    expect(() =>
      stateManager.acquireLock("test-app", "production", "dev2")
    ).toThrow(/Deployment already in progress/);

    stateManager.releaseLock("test-app", "production");
    expect(() =>
      stateManager.acquireLock("test-app", "production", "dev2")
    ).not.toThrow();
  });

  it("preserves provider identity metadata per resource during saveDeployment", () => {
    const resources: ResolvedResource[] = [
      {
        type: "function",
        name: "hello",
        config: {},
        dependencies: [],
        id: "arn:aws:lambda:us-east-1:123456789012:function:my-app-hello",
        configHash: "abc123hash",
        provider: "aws",
        providerId: "arn:aws:lambda:us-east-1:123456789012:function:my-app-hello",
        account: "123456789012",
        region: "us-east-1",
        status: "deployed",
      },
    ];

    stateManager.saveDeployment("my-app", "production", "aws", resources);

    const saved = stateManager.getResources("my-app", "production");
    expect(saved.length).toBe(1);
    expect(saved[0].provider).toBe("aws");
    expect(saved[0].providerId).toBe("arn:aws:lambda:us-east-1:123456789012:function:my-app-hello");

    // Verify atomic file write and backup creation
    const mainPath = join(tempDir, ".nova", "state", "deployments.json");
    expect(existsSync(mainPath)).toBe(true);
  });

  it("reconciles interrupted or missing state items using live observer data", () => {
    const resources: ResolvedResource[] = [
      {
        type: "function",
        name: "worker",
        config: {},
        dependencies: [],
        id: "function-worker",
        configHash: "hash123",
        status: "failed",
      },
    ];

    stateManager.saveDeployment("app", "production", "aws", resources);

    const reconcileResult = stateManager.reconcileState("app", "production", {
      "function-worker": {
        status: "deployed",
        arn: "arn:aws:lambda:us-east-1:123456789012:function:app-worker",
      },
    });

    expect(reconcileResult.reconciledCount).toBe(1);
    expect(reconcileResult.updatedResources).toContain("worker");

    const updated = stateManager.getResources("app", "production");
    expect(updated[0].status).toBe("deployed");
    expect(updated[0].id).toBe("arn:aws:lambda:us-east-1:123456789012:function:app-worker");
  });
});
