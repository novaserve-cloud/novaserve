import { describe, it, expect } from "vitest";
import { ConfigValidator } from "../src/config/validator.js";
import { DEFAULT_CONFIG } from "../src/config/schema.js";
import type { NovaApp } from "novaserve-sdk";

describe("ConfigValidator and Schema Defaults", () => {
  const validator = new ConfigValidator();

  it("exposes expected default configuration values", () => {
    expect(DEFAULT_CONFIG.region).toBe("us-east-1");
    expect(DEFAULT_CONFIG.runtime).toBe("node20");
    expect(DEFAULT_CONFIG.memory).toBe(256);
    expect(DEFAULT_CONFIG.timeout).toBe(30);
    expect(DEFAULT_CONFIG.provider).toBe("aws");
  });

  it("validates valid application configuration without errors", () => {
    const validApp: NovaApp = {
      name: "valid-service",
      config: {
        name: "valid-service",
        region: "us-east-1",
        memory: 512,
        timeout: 60,
        resources: {
          myApi: { _type: "api", _name: "gateway" },
        },
      },
      resources: [],
    };

    const result = validator.validate(validApp);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("flags errors when app name is missing or violates naming constraints", () => {
    const invalidApp: NovaApp = {
      name: "123-INVALID_NAME",
      config: {
        name: "123-INVALID_NAME",
      },
      resources: [],
    };

    const result = validator.validate(invalidApp);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("must start with a lowercase letter");
  });

  it("detects duplicate resource declarations", () => {
    const duplicateApp: NovaApp = {
      name: "dup-app",
      config: {
        name: "dup-app",
        resources: {
          res1: { _type: "function", _name: "handler" },
          res2: { _type: "function", _name: "handler" },
        },
      },
      resources: [],
    };

    const result = validator.validate(duplicateApp);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate resource"))).toBe(true);
  });

  it("flags memory allocation outside of valid thresholds", () => {
    const badMemoryApp: NovaApp = {
      name: "bad-mem",
      config: {
        name: "bad-mem",
        memory: 64, // Min is 128
      },
      resources: [],
    };

    const result = validator.validate(badMemoryApp);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Memory must be between"))).toBe(true);
  });
});
