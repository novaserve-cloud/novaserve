import { describe, it, expect } from "vitest";
import { DeploymentJournal } from "./journal.js";
import { StateManager } from "./state.js";
import { NovaCompiler, computeCanonicalHash } from "../compiler/compiler.js";

describe("Production Hardening & Failure Injection Suite", () => {
  it("tracks deployment journal states through partial failure and UNKNOWN network status", () => {
    const journal = new DeploymentJournal("dep-101", "my-app", "production", "aws", "hash-123");

    journal.startResource("func-1", "function", "usersCreate", "CREATE");
    journal.markSuccess("func-1", "arn:aws:lambda:us-east-1:12345:function:usersCreate");

    journal.startResource("queue-1", "queue", "emailQueue", "CREATE");
    journal.markUnknown("queue-1", "AWS SQS Request Timed Out (ECONNRESET)");

    const record = journal.getRecord();
    expect(record.status).toBe("UNKNOWN");
    expect(record.entries["func-1"]?.state).toBe("SUCCESS");
    expect(record.entries["queue-1"]?.state).toBe("UNKNOWN");
    expect(record.entries["queue-1"]?.error).toContain("ECONNRESET");
  });

  it("prevents concurrent deployments via StateManager locking", () => {
    const mgr = new StateManager(process.cwd());
    const lock = mgr.acquireLock("test-app", "staging", "ci-bot");
    expect(lock.lockId).toBeDefined();

    expect(() => {
      mgr.acquireLock("test-app", "staging", "developer-2");
    }).toThrow(/Deployment already in progress/);

    mgr.releaseLock("test-app", "staging");
  });

  it("produces identical canonical SHA256 hashes regardless of object key order", () => {
    const objA = { z: 1, a: "test", nested: { b: 2, a: 1 } };
    const objB = { nested: { a: 1, b: 2 }, a: "test", z: 1 };

    const hashA = computeCanonicalHash(objA);
    const hashB = computeCanonicalHash(objB);

    expect(hashA).toBe(hashB);
  });

  it("persists and loads deployment journals from disk", () => {
    const journal = new DeploymentJournal("dep-test-disk", "my-app", "production", "aws", "plan-hash-999");
    journal.startResource("fn-1", "function", "hello", "CREATE");
    journal.markSuccess("fn-1", "arn:aws:lambda:us-east-1:123:hello");
    journal.saveToDisk(process.cwd());

    const loaded = DeploymentJournal.loadFromDisk(process.cwd(), "dep-test-disk");
    expect(loaded).not.toBeNull();
    expect(loaded?.deploymentId).toBe("dep-test-disk");
    expect(loaded?.entries["fn-1"]?.arn).toBe("arn:aws:lambda:us-east-1:123:hello");

    const allJournals = DeploymentJournal.listJournals(process.cwd());
    expect(allJournals.some((j) => j.deploymentId === "dep-test-disk")).toBe(true);
  });

  it("reconciles unknown resource state using observed state", () => {
    const mgr = new StateManager(process.cwd());
    mgr.saveDeployment("reconcile-app", "production", "aws", [
      {
        type: "function",
        name: "hello",
        id: "func-hello-pending",
        config: {},
        dependencies: [],
        configHash: "abc",
        status: "failed",
      },
    ]);

    const result = mgr.reconcileState("reconcile-app", "production", {
      "function-hello": { status: "deployed", arn: "arn:aws:lambda:us-east-1:123:hello" },
    });

    expect(result.reconciledCount).toBe(1);
    const resources = mgr.getResources("reconcile-app", "production");
    expect(resources[0]?.status).toBe("deployed");
    expect(resources[0]?.id).toBe("arn:aws:lambda:us-east-1:123:hello");
  });
});
