import { describe, it, expect } from "vitest";
import { NovaCompiler } from "../compiler/compiler.js";
import { NovaDriftEngine } from "./drift.js";
import { NovaPluginManager } from "../plugins/manager.js";

describe("Nova Drift & Plugin Architecture — 10/10 Operations", () => {
  it("detects configuration drift between Nova IR and live state", () => {
    const ir = NovaCompiler.compile({
      appName: "drift-app",
      resources: [
        { type: "function", name: "usersCreate", config: { memory: 512 }, dependencies: [] },
      ],
    }).ir;

    const liveState = {
      "function-usersCreate": { config: { memory: 1024 } },
    };

    const report = NovaDriftEngine.detect(ir, liveState);
    expect(report.hasDrift).toBe(true);
    expect(report.totalDrifts).toBe(1);
    expect(report.items[0]?.attribute).toBe("memory");
    expect(report.items[0]?.expectedValue).toBe(512);
    expect(report.items[0]?.actualValue).toBe(1024);
    expect(report.items[0]?.severity).toBe("HIGH");

    const fixResult = NovaDriftEngine.fix(report);
    expect(fixResult.fixedCount).toBe(1);
  });

  it("detects unmanaged out-of-band resources and classifies security drift severity", () => {
    const ir = NovaCompiler.compile({
      appName: "security-app",
      resources: [
        { type: "storage", name: "uploads", config: { sseEncryption: true }, dependencies: [] },
      ],
    }).ir;

    const liveState = {
      "storage-uploads": { config: { sseEncryption: false } },
      "unmanaged-bucket-xyz": { name: "unmanaged-bucket-xyz", type: "storage", config: {} },
    };

    const report = NovaDriftEngine.detect(ir, liveState);
    expect(report.hasDrift).toBe(true);
    expect(report.totalDrifts).toBe(2);

    const sseDrift = report.items.find((i) => i.attribute === "sseEncryption");
    expect(sseDrift?.severity).toBe("CRITICAL");

    const unmanagedDrift = report.items.find((i) => i.attribute === "unmanaged");
    expect(unmanagedDrift?.severity).toBe("HIGH");
    expect(unmanagedDrift?.fixable).toBe(false);
  });

  it("synthesizes executable remediation plans for detected drift", () => {
    const ir = NovaCompiler.compile({
      appName: "reconcile-app",
      resources: [
        { type: "function", name: "api", config: { memory: 256 }, dependencies: [] },
      ],
    }).ir;

    const liveState = {}; // Missing completely

    const report = NovaDriftEngine.detect(ir, liveState);
    const plan = NovaDriftEngine.createDriftRemediationPlan(report, ir);

    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].action).toBe("create");
    expect(plan.actions[0].resource.name).toBe("api");
  });

  it("installs and manages capability-gated plugins", () => {
    const pkg = NovaPluginManager.install("stripe");
    expect(pkg.name).toBe("novaserve-plugin-stripe");
    expect(pkg.requiredCapabilities).toContain("add-resource");

    const installedList = NovaPluginManager.list();
    expect(installedList.some((p) => p.name === "novaserve-plugin-stripe")).toBe(true);
  });
});
