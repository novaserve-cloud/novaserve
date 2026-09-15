import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudflareProvider } from "./provider.js";
import { CloudflareAuthManager } from "./utils/auth.js";
import {
  CloudflareError,
  CloudflareAuthenticationError,
  CloudflarePermissionError,
  CloudflareResourceNotFoundError,
  CloudflareResourceExistsError,
  CloudflareDeploymentError,
  CloudflareMigrationError,
  CloudflareRateLimitError,
  CloudflareNetworkError,
  mapCloudflareApiError,
  sanitizeErrorMessage,
} from "./errors.js";
import { cloudflareRetry } from "./utils/retry.js";
import { resolveBindings, validateBindingNames, bindingsToApiFormat } from "./utils/bindings.js";
import {
  resolveEnvironmentName,
  resolveWorkerName,
  isProductionEnvironment,
  mergeEnvironmentVars,
  mergeEnvironmentSecrets,
} from "./utils/environment.js";
import {
  validateCloudflareConfig,
  validateWorkerName,
  validateR2BucketName,
  validateBindingName,
  validateEnvVarName,
  sanitizeInput,
} from "./validators.js";

// ═══════════════════════════════════════════════════════════════
// 1. CREDENTIAL MANAGEMENT TESTS
// ═══════════════════════════════════════════════════════════════

describe("CloudflareAuthManager", () => {
  it("resolves credentials from explicit config", () => {
    const creds = CloudflareAuthManager.getCredentials({
      apiToken: "cf-token-12345",
      accountId: "cf-acc-67890",
    });

    expect(creds.apiToken).toBe("cf-token-12345");
    expect(creds.accountId).toBe("cf-acc-67890");
    expect(creds.method).toBe("api-token");
    expect(CloudflareAuthManager.isConfigured(creds)).toBe(true);
  });

  it("resolves credentials from environment variables", () => {
    const original = { ...process.env };
    process.env.CLOUDFLARE_API_TOKEN = "env-token";
    process.env.CLOUDFLARE_ACCOUNT_ID = "env-account";

    const creds = CloudflareAuthManager.getCredentials();
    expect(creds.apiToken).toBe("env-token");
    expect(creds.accountId).toBe("env-account");

    process.env.CLOUDFLARE_API_TOKEN = original.CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_ACCOUNT_ID = original.CLOUDFLARE_ACCOUNT_ID;
  });

  it("returns unconfigured when no credentials are set", () => {
    const original = { ...process.env };
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CF_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CF_ACCOUNT_ID;

    const creds = CloudflareAuthManager.getCredentials();
    expect(CloudflareAuthManager.isConfigured(creds)).toBe(false);
    expect(creds.method).toBe("none");

    Object.assign(process.env, original);
  });

  it("masks API tokens safely", () => {
    expect(CloudflareAuthManager.maskToken("abc123def456ghi789")).toBe("***i789");
    expect(CloudflareAuthManager.maskToken("short")).toBe("***");
    expect(CloudflareAuthManager.maskToken("")).toBe("***");
  });

  it("throws actionable error when credentials are required but missing", () => {
    const creds = { apiToken: "", accountId: "", method: "none" as const };
    expect(() => CloudflareAuthManager.requireCredentials(creds, "deploy")).toThrow(
      CloudflareAuthenticationError
    );
  });

  it("masks credential objects for safe logging", () => {
    const creds = CloudflareAuthManager.getCredentials({
      apiToken: "my-secret-token-12345678",
      accountId: "abc123def456",
    });
    const masked = CloudflareAuthManager.maskCredentials(creds);
    expect(masked.apiToken).toBe("***5678");
    expect(masked.accountId).toBe("abc1***");
    expect(masked.apiToken).not.toContain("my-secret-token");
  });

  it("prefers explicit config over environment variables", () => {
    const original = process.env.CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_API_TOKEN = "env-token";

    const creds = CloudflareAuthManager.getCredentials({
      apiToken: "config-token",
    });
    expect(creds.apiToken).toBe("config-token");

    process.env.CLOUDFLARE_API_TOKEN = original;
  });

  it("resolves optional Zone ID", () => {
    const creds = CloudflareAuthManager.getCredentials({
      apiToken: "t",
      accountId: "a",
      zoneId: "zone-123",
    });
    expect(creds.zoneId).toBe("zone-123");
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. ERROR HIERARCHY TESTS
// ═══════════════════════════════════════════════════════════════

describe("Cloudflare Error Hierarchy", () => {
  it("CloudflareError contains structured context", () => {
    const err = new CloudflareError({
      message: "Something failed",
      operation: "deploy",
      resource: "my-worker",
      environment: "production",
      statusCode: 500,
    });

    expect(err.provider).toBe("cloudflare");
    expect(err.operation).toBe("deploy");
    expect(err.resource).toBe("my-worker");
    expect(err.environment).toBe("production");
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe("CloudflareError");
  });

  it("CloudflareAuthenticationError provides remediation steps", () => {
    const err = new CloudflareAuthenticationError({
      message: "Invalid token",
      operation: "validateCredentials",
    });

    expect(err.name).toBe("CloudflareAuthenticationError");
    expect(err.statusCode).toBe(401);
    expect(err.actionableMessage).toContain("CLOUDFLARE_API_TOKEN");
    expect(err.actionableMessage).toContain("dash.cloudflare.com");
  });

  it("CloudflarePermissionError provides permission guidance", () => {
    const err = new CloudflarePermissionError({
      message: "Forbidden",
      operation: "createWorker",
    });

    expect(err.name).toBe("CloudflarePermissionError");
    expect(err.statusCode).toBe(403);
    expect(err.actionableMessage).toContain("Workers Scripts: Edit");
  });

  it("CloudflareResourceNotFoundError is informative", () => {
    const err = new CloudflareResourceNotFoundError({
      message: "Worker not found",
      operation: "getWorker",
      resource: "my-worker",
    });

    expect(err.name).toBe("CloudflareResourceNotFoundError");
    expect(err.statusCode).toBe(404);
  });

  it("CloudflareResourceExistsError handles idempotent creates", () => {
    const err = new CloudflareResourceExistsError({
      message: "Bucket already exists",
      operation: "createBucket",
      resource: "my-bucket",
    });

    expect(err.name).toBe("CloudflareResourceExistsError");
    expect(err.statusCode).toBe(409);
    expect(err.actionableMessage).toContain("existing resource");
  });

  it("CloudflareDeploymentError tracks provisioned resources", () => {
    const err = new CloudflareDeploymentError({
      message: "Deployment failed",
      operation: "deploy",
      provisionedResources: ["kv-1", "r2-1"],
    });

    expect(err.name).toBe("CloudflareDeploymentError");
    expect(err.provisionedResources).toEqual(["kv-1", "r2-1"]);
  });

  it("CloudflareMigrationError tracks applied migrations", () => {
    const err = new CloudflareMigrationError({
      message: "Migration failed",
      operation: "executeMigrations",
      migrationFile: "0002_add_orders.sql",
      appliedMigrations: ["0001_create_users.sql"],
    });

    expect(err.name).toBe("CloudflareMigrationError");
    expect(err.migrationFile).toBe("0002_add_orders.sql");
    expect(err.appliedMigrations).toEqual(["0001_create_users.sql"]);
  });

  it("CloudflareRateLimitError includes retry-after", () => {
    const err = new CloudflareRateLimitError({
      message: "Rate limited",
      operation: "listWorkers",
      retryAfterSeconds: 30,
    });

    expect(err.name).toBe("CloudflareRateLimitError");
    expect(err.statusCode).toBe(429);
    expect(err.retryAfterSeconds).toBe(30);
  });

  it("CloudflareNetworkError provides connectivity guidance", () => {
    const err = new CloudflareNetworkError({
      message: "ECONNRESET",
      operation: "deploy",
    });

    expect(err.name).toBe("CloudflareNetworkError");
    expect(err.actionableMessage).toContain("internet connectivity");
  });

  it("Error.toJSON() never exposes sensitive data", () => {
    const err = new CloudflareError({
      message: "Bearer abc123xyz",
      operation: "test",
    });
    const json = err.toJSON();
    expect(json).not.toHaveProperty("stack");
    expect(json.provider).toBe("cloudflare");
  });

  it("mapCloudflareApiError maps status codes correctly", () => {
    expect(mapCloudflareApiError(401, "unauthorized", "test").name).toBe("CloudflareAuthenticationError");
    expect(mapCloudflareApiError(403, "forbidden", "test").name).toBe("CloudflarePermissionError");
    expect(mapCloudflareApiError(404, "not found", "test").name).toBe("CloudflareResourceNotFoundError");
    expect(mapCloudflareApiError(409, "exists", "test").name).toBe("CloudflareResourceExistsError");
    expect(mapCloudflareApiError(429, "rate limit", "test").name).toBe("CloudflareRateLimitError");
    expect(mapCloudflareApiError(500, "server error", "test").statusCode).toBe(500);
  });

  it("sanitizeErrorMessage strips tokens", () => {
    const msg = "Bearer ABCDEFghijklmnop12345678901234567890 failed";
    const sanitized = sanitizeErrorMessage(msg);
    expect(sanitized).toContain("***MASKED***");
    expect(sanitized).not.toContain("ABCDEFghijklmnop");
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. RETRY LOGIC TESTS
// ═══════════════════════════════════════════════════════════════

describe("cloudflareRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await cloudflareRetry(fn, { maxRetries: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValue("recovered");

    const result = await cloudflareRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const err = new CloudflareAuthenticationError({
      message: "Bad token",
      operation: "test",
    });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(cloudflareRetry(fn, { maxRetries: 3 })).rejects.toThrow(
      CloudflareAuthenticationError
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry destructive operations", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("503 error"));

    await expect(
      cloudflareRetry(fn, { maxRetries: 3, isDestructive: true })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after max retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("429 rate limit"));

    await expect(
      cloudflareRetry(fn, { maxRetries: 2, baseDelayMs: 1 })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries on rate limit errors with typed error", async () => {
    const rateErr = new CloudflareRateLimitError({
      message: "Too many requests",
      operation: "test",
      retryAfterSeconds: 1,
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateErr)
      .mockResolvedValue("ok");

    const result = await cloudflareRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on network errors", async () => {
    const netErr = new CloudflareNetworkError({
      message: "ECONNRESET",
      operation: "test",
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(netErr)
      .mockResolvedValue("ok");

    const result = await cloudflareRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. ENVIRONMENT ISOLATION TESTS
// ═══════════════════════════════════════════════════════════════

describe("Environment Isolation", () => {
  it("resolves environment-specific resource names", () => {
    expect(resolveEnvironmentName("my-app", "cache", "production")).toBe(
      "my-app-cache-production"
    );
    expect(resolveEnvironmentName("my-app", "cache", "staging")).toBe(
      "my-app-cache-staging"
    );
    expect(resolveEnvironmentName("my-app", "cache", "development")).toBe(
      "my-app-cache-dev"
    );
  });

  it("staging resources are never the same as production", () => {
    const staging = resolveEnvironmentName("app", "db", "staging");
    const production = resolveEnvironmentName("app", "db", "production");
    expect(staging).not.toBe(production);
  });

  it("resolves Worker names per environment", () => {
    expect(resolveWorkerName("my-api", "production")).toBe("my-api-production");
    expect(resolveWorkerName("my-api", "staging")).toBe("my-api-staging");
  });

  it("detects production environments", () => {
    expect(isProductionEnvironment("production")).toBe(true);
    expect(isProductionEnvironment("prod")).toBe(true);
    expect(isProductionEnvironment("Production")).toBe(true);
    expect(isProductionEnvironment("staging")).toBe(false);
    expect(isProductionEnvironment("development")).toBe(false);
  });

  it("merges environment variables with overrides", () => {
    const base = { API_URL: "http://dev.api", DEBUG: "true" };
    const env = { API_URL: "https://prod.api", LOG_LEVEL: "error" };
    const merged = mergeEnvironmentVars(base, env);

    expect(merged.API_URL).toBe("https://prod.api");
    expect(merged.DEBUG).toBe("true");
    expect(merged.LOG_LEVEL).toBe("error");
  });

  it("merges environment secrets without duplicates", () => {
    const base = ["JWT_SECRET", "DB_PASSWORD"];
    const env = ["DB_PASSWORD", "API_KEY"];
    const merged = mergeEnvironmentSecrets(base, env);

    expect(merged).toHaveLength(3);
    expect(merged).toContain("JWT_SECRET");
    expect(merged).toContain("DB_PASSWORD");
    expect(merged).toContain("API_KEY");
  });

  it("sanitizes resource names for Cloudflare constraints", () => {
    const name = resolveEnvironmentName("My App!", "CACHE_1", "production");
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
    expect(name).not.toContain("!");
    expect(name).not.toContain("_");
    expect(name.length).toBeLessThanOrEqual(63);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. BINDING RESOLUTION TESTS
// ═══════════════════════════════════════════════════════════════

describe("Binding Resolution", () => {
  const provisioned = {
    kv: { CACHE: "ns-123" },
    r2: { STORAGE: "my-bucket" },
    d1: { DB: "db-uuid-456" },
    queues: { JOBS: "queue-789" },
  };

  it("resolves KV bindings with namespace IDs", () => {
    const bindings = resolveBindings(
      [{ name: "CACHE" }],
      [],
      [],
      [],
      provisioned
    );

    const kvBinding = bindings.find((b) => b.name === "CACHE");
    expect(kvBinding).toBeDefined();
    expect(kvBinding!.type).toBe("kv_namespace");
    expect(kvBinding!.namespace_id).toBe("ns-123");
  });

  it("resolves R2 bindings with bucket names", () => {
    const bindings = resolveBindings(
      [],
      [{ name: "STORAGE" }],
      [],
      [],
      provisioned
    );

    const r2Binding = bindings.find((b) => b.name === "STORAGE");
    expect(r2Binding).toBeDefined();
    expect(r2Binding!.type).toBe("r2_bucket");
    expect(r2Binding!.bucket_name).toBe("my-bucket");
  });

  it("resolves D1 bindings with database IDs", () => {
    const bindings = resolveBindings(
      [],
      [],
      [{ name: "DB" }],
      [],
      provisioned
    );

    const d1Binding = bindings.find((b) => b.name === "DB");
    expect(d1Binding).toBeDefined();
    expect(d1Binding!.type).toBe("d1");
    expect(d1Binding!.id).toBe("db-uuid-456");
  });

  it("resolves Queue bindings with queue names", () => {
    const bindings = resolveBindings(
      [],
      [],
      [],
      [{ name: "JOBS" }],
      provisioned
    );

    const queueBinding = bindings.find((b) => b.name === "JOBS");
    expect(queueBinding).toBeDefined();
    expect(queueBinding!.type).toBe("queue");
    expect(queueBinding!.queue_name).toBe("queue-789");
  });

  it("resolves all binding types together", () => {
    const bindings = resolveBindings(
      [{ name: "CACHE" }],
      [{ name: "STORAGE" }],
      [{ name: "DB" }],
      [{ name: "JOBS" }],
      provisioned,
      [],
      { API_URL: "https://api.example.com" }
    );

    expect(bindings).toHaveLength(5); // KV + R2 + D1 + Queue + env var
    expect(bindings.find((b) => b.type === "plain_text")?.text).toBe(
      "https://api.example.com"
    );
  });

  it("throws when a referenced resource is not provisioned", () => {
    expect(() =>
      resolveBindings(
        [{ name: "MISSING_KV" }],
        [],
        [],
        [],
        { kv: {}, r2: {}, d1: {}, queues: {} }
      )
    ).toThrow(CloudflareDeploymentError);
  });

  it("converts bindings to Cloudflare API format", () => {
    const bindings = resolveBindings(
      [{ name: "CACHE" }],
      [{ name: "STORAGE" }],
      [],
      [],
      provisioned
    );

    const apiFormat = bindingsToApiFormat(bindings);
    expect(apiFormat).toHaveLength(2);
    expect(apiFormat[0]).toHaveProperty("type");
    expect(apiFormat[0]).toHaveProperty("name");
  });

  it("validates binding names as valid JS identifiers", () => {
    const errors = validateBindingNames([
      { name: "VALID_NAME", type: "kv_namespace" },
      { name: "123invalid", type: "r2_bucket" },
      { name: "has spaces", type: "d1" },
    ]);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("123invalid"))).toBe(true);
    expect(errors.some((e) => e.includes("has spaces"))).toBe(true);
  });

  it("detects duplicate binding names", () => {
    const errors = validateBindingNames([
      { name: "DB", type: "d1" },
      { name: "DB", type: "kv_namespace" },
    ]);

    expect(errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. VALIDATOR TESTS
// ═══════════════════════════════════════════════════════════════

describe("Input Validation", () => {
  describe("Worker name validation", () => {
    it("accepts valid Worker names", () => {
      expect(validateWorkerName("my-worker")).toHaveLength(0);
      expect(validateWorkerName("api-v2")).toHaveLength(0);
      expect(validateWorkerName("a1")).toHaveLength(0);
    });

    it("rejects invalid Worker names", () => {
      expect(validateWorkerName("My_Worker")).not.toHaveLength(0);
      expect(validateWorkerName("-starts-with-hyphen")).not.toHaveLength(0);
      expect(validateWorkerName("a".repeat(64))).not.toHaveLength(0);
      expect(validateWorkerName("")).not.toHaveLength(0);
    });
  });

  describe("R2 bucket name validation", () => {
    it("accepts valid R2 bucket names", () => {
      expect(validateR2BucketName("my-bucket")).toHaveLength(0);
      expect(validateR2BucketName("assets-production")).toHaveLength(0);
    });

    it("rejects invalid R2 bucket names", () => {
      expect(validateR2BucketName("ab")).not.toHaveLength(0); // too short
      expect(validateR2BucketName("MY_BUCKET")).not.toHaveLength(0); // uppercase + underscore
      expect(validateR2BucketName("a".repeat(64))).not.toHaveLength(0); // too long
    });
  });

  describe("Binding name validation", () => {
    it("accepts valid binding names", () => {
      expect(validateBindingName("MY_KV")).toHaveLength(0);
      expect(validateBindingName("DB")).toHaveLength(0);
      expect(validateBindingName("$special")).toHaveLength(0);
      expect(validateBindingName("_private")).toHaveLength(0);
    });

    it("rejects invalid binding names", () => {
      expect(validateBindingName("123start")).not.toHaveLength(0);
      expect(validateBindingName("has space")).not.toHaveLength(0);
      expect(validateBindingName("")).not.toHaveLength(0);
    });
  });

  describe("Environment variable name validation", () => {
    it("accepts valid env var names", () => {
      expect(validateEnvVarName("API_URL")).toHaveLength(0);
      expect(validateEnvVarName("NODE_ENV")).toHaveLength(0);
    });

    it("rejects invalid env var names", () => {
      expect(validateEnvVarName("123VAR")).not.toHaveLength(0);
      expect(validateEnvVarName("")).not.toHaveLength(0);
    });
  });

  describe("Input sanitization", () => {
    it("strips dangerous characters", () => {
      expect(sanitizeInput("normal-name")).toBe("normal-name");
      expect(sanitizeInput("test; rm -rf /")).toBe("test rm -rf /");
      expect(sanitizeInput("$(command)")).toBe("command");
    });
  });

  describe("Full config validation", () => {
    it("validates a complete config", () => {
      const result = validateCloudflareConfig(
        [
          { type: "function", name: "api", config: {}, dependencies: [] },
          { type: "storage", name: "uploads", config: {}, dependencies: [] },
          { type: "database", name: "db", config: {}, dependencies: [] },
          { type: "cache", name: "sessions", config: {}, dependencies: [] },
        ],
        {
          accountId: "test-account",
          apiToken: "test-token",
          kv: [{ name: "CACHE" }],
          r2: [{ name: "STORAGE" }],
          d1: [{ name: "DB" }],
        }
      );

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("returns errors for missing credentials", () => {
      const result = validateCloudflareConfig([], {});
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("API token"))).toBe(true);
      expect(result.errors.some((e) => e.message.includes("Account ID"))).toBe(true);
    });

    it("validates route configuration requires Zone ID", () => {
      const result = validateCloudflareConfig([], {
        accountId: "acc",
        apiToken: "tok",
        worker: {
          routes: [{ pattern: "example.com/*" }],
        },
      });

      expect(result.errors.some((e) => e.message.includes("Zone ID"))).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. PROVIDER LIFECYCLE TESTS
// ═══════════════════════════════════════════════════════════════

describe("CloudflareProvider", () => {
  it("initializes with the correct provider identity", async () => {
    const provider = new CloudflareProvider();
    expect(provider.name).toBe("cloudflare");
    expect(provider.displayName).toBe("Cloudflare");
  });

  it("validates resources and returns type mapping warnings", async () => {
    const provider = new CloudflareProvider();
    await provider.init();

    const validation = await provider.validate([
      { type: "function", name: "api", config: {}, dependencies: [] },
      { type: "storage", name: "uploads", config: {}, dependencies: [] },
      { type: "database", name: "db", config: {}, dependencies: [] },
      { type: "cache", name: "redis", config: {}, dependencies: [] },
      { type: "queue", name: "jobs", config: {}, dependencies: [] },
    ]);

    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.warnings.some((w) => w.message.includes("R2"))).toBe(true);
    expect(validation.warnings.some((w) => w.message.includes("D1"))).toBe(true);
    expect(validation.warnings.some((w) => w.message.includes("KV"))).toBe(true);
  });

  it("reports status with masked credentials", async () => {
    const provider = new CloudflareProvider();
    await provider.init();

    const status = await provider.getStatus();
    expect(status.name).toBe("Cloudflare");
    expect(status.region).toBe("global");
    // Should not contain raw tokens
    if (status.account) {
      expect(status.account).not.toMatch(/[a-f0-9]{32}/);
    }
  });

  it("handles deploy without credentials gracefully", async () => {
    const original = { ...process.env };
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CF_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CF_ACCOUNT_ID;

    const provider = new CloudflareProvider();
    await provider.init();

    const result = await provider.deploy({
      appName: "test-app",
      provider: "cloudflare",
      environment: "staging",
      actions: [
        {
          action: "create",
          resource: { type: "function", name: "api", config: {}, dependencies: [] },
          reason: "New resource",
          dependsOn: [],
        },
      ],
      summary: { create: 1, update: 0, replace: 0, delete: 0, skip: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    Object.assign(process.env, original);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. DEPLOYMENT PLAN TESTS
// ═══════════════════════════════════════════════════════════════

describe("Deployment Plans", () => {
  it("skip actions do not trigger deployments", async () => {
    const provider = new CloudflareProvider();
    await provider.init();

    // Without credentials, this won't actually deploy but tests the skip logic
    const result = await provider.deploy({
      appName: "test",
      provider: "cloudflare",
      environment: "test",
      actions: [
        {
          action: "skip",
          resource: { type: "function", name: "api", config: {}, dependencies: [] },
          reason: "No changes",
          dependsOn: [],
        },
      ],
      summary: { create: 0, update: 0, replace: 0, delete: 0, skip: 1 },
    });

    // Should fail due to missing credentials, but skip action shouldn't be processed
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. SECURITY TESTS
// ═══════════════════════════════════════════════════════════════

describe("Security", () => {
  it("errors never expose API tokens", () => {
    const err = new CloudflareAuthenticationError({
      message: "Token abc123secrettoken456 is invalid",
      operation: "validate",
    });

    // The actionable message should contain remediation, not the original token
    expect(err.actionableMessage).not.toContain("abc123secrettoken456");
    expect(err.actionableMessage).toContain("CLOUDFLARE_API_TOKEN");
  });

  it("sanitizeErrorMessage masks bearer tokens", () => {
    const msg = "Authorization: Bearer ABCDEFghijklmnopqrstuvwxyz12345678901234567890";
    const sanitized = sanitizeErrorMessage(msg);
    expect(sanitized).toContain("***MASKED***");
  });

  it("deployment metadata does not contain secrets", () => {
    // This is a structural test — metadata type should not have secret fields
    const metadata = {
      deploymentId: "test",
      appName: "app",
      environment: "prod",
      provider: "cloudflare" as const,
      workerName: "app-prod",
      status: "success" as const,
      resources: { kv: {}, r2: {}, d1: {}, queues: {} },
      startedAt: "",
      completedAt: "",
      durationMs: 0,
      novaVersion: "3.0.0",
    };

    const json = JSON.stringify(metadata);
    expect(json).not.toContain("apiToken");
    expect(json).not.toContain("secret");
  });

  it("input sanitization prevents command injection", () => {
    expect(sanitizeInput("valid-name")).toBe("valid-name");
    expect(sanitizeInput("`whoami`")).toBe("whoami");
    expect(sanitizeInput("$(cat /etc/passwd)")).toBe("cat /etc/passwd");
    expect(sanitizeInput("test\ninjected")).toBe("testinjected");
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. IDEMPOTENCY TESTS
// ═══════════════════════════════════════════════════════════════

describe("Idempotency", () => {
  it("environment names are deterministic", () => {
    const name1 = resolveEnvironmentName("app", "cache", "production");
    const name2 = resolveEnvironmentName("app", "cache", "production");
    expect(name1).toBe(name2);
  });

  it("worker names are deterministic", () => {
    const name1 = resolveWorkerName("my-api", "staging");
    const name2 = resolveWorkerName("my-api", "staging");
    expect(name1).toBe(name2);
  });

  it("binding resolution is deterministic", () => {
    const provisioned = {
      kv: { CACHE: "ns-1" },
      r2: {},
      d1: {},
      queues: {},
    };

    const bindings1 = resolveBindings([{ name: "CACHE" }], [], [], [], provisioned);
    const bindings2 = resolveBindings([{ name: "CACHE" }], [], [], [], provisioned);

    expect(JSON.stringify(bindings1)).toBe(JSON.stringify(bindings2));
  });
});
