import { describe, it, expect } from "vitest";
import { isRetriableError, awsRetry } from "./retry.js";

describe("AWS Retry Engine with Exponential Backoff & Jitter", () => {
  it("correctly identifies retriable AWS error types", () => {
    expect(isRetriableError({ name: "ThrottlingException" })).toBe(true);
    expect(isRetriableError({ name: "TooManyRequestsException" })).toBe(true);
    expect(isRetriableError({ $metadata: { httpStatusCode: 503 } })).toBe(true);
    expect(isRetriableError(new Error("socket hang up"))).toBe(true);
    expect(isRetriableError(new Error("The role defined for the function cannot be assumed"))).toBe(true);

    expect(isRetriableError({ name: "AccessDeniedException" })).toBe(false);
    expect(isRetriableError({ name: "ValidationException" })).toBe(false);
  });

  it("retries transient errors and succeeds upon recovery", async () => {
    let attempts = 0;
    const result = await awsRetry(
      async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error("Throttled");
          err.name = "ThrottlingException";
          throw err;
        }
        return "SUCCESS";
      },
      { baseDelayMs: 10, maxRetries: 4 }
    );

    expect(result).toBe("SUCCESS");
    expect(attempts).toBe(3);
  });

  it("fails fast on non-retriable auth/validation errors", async () => {
    let attempts = 0;
    await expect(
      awsRetry(
        async () => {
          attempts++;
          const err = new Error("User is not authorized");
          err.name = "AccessDeniedException";
          throw err;
        },
        { baseDelayMs: 10, maxRetries: 4 }
      )
    ).rejects.toThrow("User is not authorized");

    expect(attempts).toBe(1);
  });
});
