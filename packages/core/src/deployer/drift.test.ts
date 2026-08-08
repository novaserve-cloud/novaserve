import { describe, it, expect } from "vitest";
import { NovaCompiler } from "../compiler/compiler.js";
import { NovaDriftEngine } from "./drift.js";
import { NovaPluginManager } from "../plugins/manager.js";

describe("Nova Drift & Plugin Architecture", () => {
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

    const fixResult = NovaDriftEngine.fix(report);
    expect(fixResult.fixedCount).toBe(1);
  });

  it("installs and manages capability-gated plugins", () => {
    const pkg = NovaPluginManager.install("stripe");
    expect(pkg.name).toBe("novaserve-plugin-stripe");
    expect(pkg.requiredCapabilities).toContain("add-resource");

    const installedList = NovaPluginManager.list();
    expect(installedList.some((p) => p.name === "novaserve-plugin-stripe")).toBe(true);
  });
});
