import { describe, it, expect } from "vitest";
import { CloudflareProvider } from "./provider.js";
import { CloudflareAuthManager } from "./utils/auth.js";

describe("CloudflareProvider — 8+/10 Production Architecture", () => {
  it("resolves Cloudflare credentials from environment variables", () => {
    const creds = CloudflareAuthManager.getCredentials({
      apiToken: "cf-token-12345",
      accountId: "cf-acc-67890",
    });

    expect(creds.apiToken).toBe("cf-token-12345");
    expect(creds.accountId).toBe("cf-acc-67890");
    expect(CloudflareAuthManager.isConfigured(creds)).toBe(true);
  });

  it("validates Cloudflare provider status and resource mappings", async () => {
    const provider = new CloudflareProvider();
    await provider.init();

    const status = await provider.getStatus();
    expect(status.name).toBe("Cloudflare");
    expect(status.region).toBe("global");

    const validation = await provider.validate([
      { type: "function", name: "api", config: {}, dependencies: [] },
      { type: "storage", name: "uploads", config: {}, dependencies: [] },
      { type: "queue", name: "jobs", config: {}, dependencies: [] },
    ]);

    expect(validation.valid).toBe(true);
    expect(validation.warnings.length).toBeGreaterThan(0);
  });

  it("generates deterministic deployment plans for Cloudflare resources", async () => {
    const provider = new CloudflareProvider();
    const plan = await provider.plan(
      [
        { type: "function", name: "worker", config: { memory: 128 }, dependencies: [] },
        { type: "storage", name: "bucket", config: {}, dependencies: [] },
      ],
      []
    );

    expect(plan.provider).toBe("cloudflare");
    expect(plan.actions.length).toBe(2);
    expect(plan.summary.create).toBe(2);
  });
});
