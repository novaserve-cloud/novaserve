import { describe, it, expect } from "vitest";
import { NovaCompiler, computeCanonicalHash } from "../src/compiler/compiler.js";
import { validateCapabilities, KNOWN_PROVIDER_CAPABILITIES } from "../src/compiler/capabilities.js";
import type { Resource } from "../src/types/resources.js";

describe("NovaCompiler", () => {
  it("compiles a valid single function configuration into deterministic Nova IR", () => {
    const resources: Resource[] = [
      {
        type: "function",
        name: "getUser",
        config: { memory: 512, timeout: 30, handler: "src/user.handler" },
        dependencies: [],
      },
    ];

    const result = NovaCompiler.compile({
      appName: "my-service",
      environment: "production",
      region: "us-east-1",
      resources,
    });

    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
    expect(result.ir.app.name).toBe("my-service");
    expect(result.ir.schemaVersion).toBe("1.0.0");
    expect(result.ir.resources["function-getUser"]).toBeDefined();
    expect(result.ir.resources["function-getUser"].type).toBe("function");
    expect(result.ir.resources["function-getUser"].config.memory).toBe(512);
    expect(result.ir.app.hash).toBeDefined();
    expect(typeof result.ir.app.hash).toBe("string");
  });

  it("produces deterministic IR hashes for identical resources irrespective of property order", () => {
    const hash1 = computeCanonicalHash({ a: 1, b: 2, c: { d: "hello", e: [1, 2] } });
    const hash2 = computeCanonicalHash({ c: { e: [1, 2], d: "hello" }, b: 2, a: 1 });
    expect(hash1).toBe(hash2);
  });

  it("fails validation when a resource references an unknown dependency", () => {
    const resources: Resource[] = [
      {
        type: "function",
        name: "processOrder",
        config: { handler: "src/order.handler" },
        dependencies: ["non-existent-db"],
      },
    ];

    const result = NovaCompiler.compile({
      appName: "shop-app",
      resources,
    });

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
    expect(result.validation.errors[0]).toContain("references unknown dependency");
  });

  it("detects cyclic dependencies in resource graph and reports error", () => {
    const resources: Resource[] = [
      {
        type: "function",
        name: "fnA",
        config: {},
        dependencies: ["function-fnB"],
      },
      {
        type: "function",
        name: "fnB",
        config: {},
        dependencies: ["function-fnA"],
      },
    ];

    const result = NovaCompiler.compile({
      appName: "shop-app",
      resources,
    });

    expect(result.validation.valid).toBe(false);
    expect(result.validation.cycleDetected).toBeDefined();
  });

  it("validates provider capabilities against declared resources", () => {
    const awsCapabilities = KNOWN_PROVIDER_CAPABILITIES["aws"];
    expect(awsCapabilities).toBeDefined();

    const validation = validateCapabilities(
      [
        { resourceId: "function-test", capability: "compute" },
        { resourceId: "storage-test", capability: "storage" },
      ],
      "aws"
    );
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
