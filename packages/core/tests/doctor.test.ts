import { describe, it, expect } from "vitest";
import { NovaDoctorEngine } from "../src/doctor/engine.js";
import { NovaCompiler } from "../src/compiler/compiler.js";
import type { Resource } from "../src/types/resources.js";

describe("NovaDoctorEngine Diagnostics", () => {
  it("passes runtime and environment checks under Node >= 20", () => {
    const report = NovaDoctorEngine.diagnose(undefined, "v20.10.0");
    expect(report.passedCount).toBeGreaterThanOrEqual(2);

    const nodeCheck = report.checks.find((c) => c.id === "DOC-NODE-001");
    expect(nodeCheck?.status).toBe("pass");
  });

  it("fails runtime check under legacy Node < 20", () => {
    const report = NovaDoctorEngine.diagnose(undefined, "v16.14.0");
    const nodeCheck = report.checks.find((c) => c.id === "DOC-NODE-001");
    expect(nodeCheck?.status).toBe("fail");
  });

  it("warns when public storage bucket is detected without credentials", () => {
    const resources: Resource[] = [
      {
        type: "storage",
        name: "publicBucket",
        config: { public: true },
        dependencies: [],
      },
    ];

    const { ir } = NovaCompiler.compile({ appName: "diag-app", resources });
    const report = NovaDoctorEngine.diagnose(ir);

    const storageCheck = report.checks.find((c) => c.id.startsWith("DOC-STR-001"));
    expect(storageCheck).toBeDefined();
    expect(storageCheck?.status).toBe("warn");
    expect(storageCheck?.fixable).toBe(true);
  });

  it("warns when queues lack dead-letter queue (DLQ) configuration", () => {
    const resources: Resource[] = [
      {
        type: "queue",
        name: "orders",
        config: {},
        dependencies: [],
      },
    ];

    const { ir } = NovaCompiler.compile({ appName: "diag-app", resources });
    const report = NovaDoctorEngine.diagnose(ir);

    const dlqCheck = report.checks.find((c) => c.id.startsWith("DOC-QUEUE-001"));
    expect(dlqCheck).toBeDefined();
    expect(dlqCheck?.status).toBe("warn");
  });

  it("provides deterministic auto-fix items when fix is called", () => {
    const resources: Resource[] = [
      {
        type: "storage",
        name: "sensitive-files",
        config: { public: true },
        dependencies: [],
      },
    ];

    const { ir } = NovaCompiler.compile({ appName: "diag-app", resources });
    const report = NovaDoctorEngine.diagnose(ir);
    const fixResult = NovaDoctorEngine.fix(report);

    expect(fixResult.fixedCount).toBeGreaterThanOrEqual(1);
    expect(fixResult.fixedItems.length).toBe(fixResult.fixedCount);
  });
});
