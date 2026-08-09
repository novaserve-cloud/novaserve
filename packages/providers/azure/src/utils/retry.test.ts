import { describe, it, expect } from "vitest";
import { isAzureRetriableError, azureRetry } from "./retry.js";

describe("Azure Retry Engine with Exponential Backoff & Jitter", () => {
  it("correctly identifies retriable Azure ARM error types", () => {
    expect(isAzureRetriableError({ statusCode: 429 })).toBe(true);
    expect(isAzureRetriableError({ statusCode: 503 })).toBe(true);
    expect(isAzureRetriableError({ code: "RoleAssignmentExists" })).toBe(true);
    expect(isAzureRetriableError(new Error("socket hang up"))).toBe(true);

    expect(isAzureRetriableError({ code: "InvalidTemplateDeployment" })).toBe(false);
    expect(isAzureRetriableError({ code: "AuthorizationFailed" })).toBe(false);
  });

  it("retries transient Azure errors and succeeds upon recovery", async () => {
    let attempts = 0;
    const result = await azureRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw { statusCode: 429, message: "Rate limit exceeded" };
        }
        return "SUCCESS";
      },
      { baseDelayMs: 10, maxRetries: 4 }
    );

    expect(result).toBe("SUCCESS");
    expect(attempts).toBe(3);
  });

  it("fails fast on non-retriable authorization errors", async () => {
    let attempts = 0;
    await expect(
      azureRetry(
        async () => {
          attempts++;
          throw { code: "AuthorizationFailed", message: "User is not authorized" };
        },
        { baseDelayMs: 10, maxRetries: 4 }
      )
    ).rejects.toEqual({ code: "AuthorizationFailed", message: "User is not authorized" });

    expect(attempts).toBe(1);
  });
});
