import { describe, it, expect } from "vitest";
import { AWSProvider } from "../src/provider.js";
import type { Resource } from "novaserve-core";

describe("AWSProvider Validation and Lifecycle", () => {
  const provider = new AWSProvider();

  it("has correct provider identifier metadata", () => {
    expect(provider.name).toBe("aws");
    expect(provider.displayName).toBe("Amazon Web Services");
  });

  it("validates valid Lambda compute and S3 storage resources", async () => {
    const resources: Resource[] = [
      {
        type: "function",
        name: "myLambda",
        config: { memory: 512 },
        dependencies: [],
      },
      {
        type: "storage",
        name: "my-valid-bucket-name",
        config: {},
        dependencies: [],
      },
    ];

    const validation = await provider.validate(resources);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("rejects Lambda memory allocations outside of 128MB - 10240MB range", async () => {
    const resources: Resource[] = [
      {
        type: "function",
        name: "tooSmallLambda",
        config: { memory: 64 },
        dependencies: [],
      },
      {
        type: "function",
        name: "tooLargeLambda",
        config: { memory: 20000 },
        dependencies: [],
      },
    ];

    const validation = await provider.validate(resources);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(2);
    expect(validation.errors[0].message).toContain("Lambda memory must be 128-10240 MB");
  });

  it("returns unconfigured status when AWS credentials are not set", async () => {
    // When no real credentials exist in environment
    const status = await provider.getStatus();
    expect(status.name).toBe("Amazon Web Services");
    if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
      expect(status.configured).toBe(false);
      expect(status.warnings?.length).toBeGreaterThan(0);
    }
  });
});
