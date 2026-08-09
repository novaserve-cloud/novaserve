/**
 * AWS Retry Engine with Exponential Backoff & Full Jitter
 *
 * Implements production-grade retry policies for transient network errors,
 * AWS throttling/5xx responses, and IAM eventual consistency propagation.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  retryIf?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "retryIf">> = {
  maxRetries: 5,
  baseDelayMs: 250,
  maxDelayMs: 8000,
  jitterMs: 150,
};

/** Check whether an error is transient and safe to retry */
export function isRetriableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errName = (error as any).name || "";
  const errCode = (error as any).code || (error as any).Code || "";
  const errMsg = (error as any).message || "";
  const statusCode = (error as any).$metadata?.httpStatusCode || 0;

  // Throttling / Rate Limits
  if (
    [
      "ThrottlingException",
      "Throttling",
      "TooManyRequestsException",
      "ProvisionedThroughputExceededException",
      "RequestLimitExceeded",
      "LimitExceededException",
    ].includes(errName) ||
    statusCode === 429
  ) {
    return true;
  }

  // AWS Server 5xx Errors
  if (statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // Network Failure & Socket Reset
  if (
    [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNREFUSED",
      "EPIPE",
      "TimeoutError",
      "NetworkingError",
    ].includes(errCode) ||
    errMsg.includes("socket hang up") ||
    errMsg.includes("network timeout") ||
    errMsg.includes("EPIPE")
  ) {
    return true;
  }

  // IAM Eventual Consistency (Lambda role propagation race)
  if (
    errMsg.includes("The role defined for the function cannot be assumed") ||
    errMsg.includes("InvalidParameterValueException: The role defined for the function cannot be assumed")
  ) {
    return true;
  }

  return false;
}

/**
 * Execute an async AWS SDK call with exponential backoff & full jitter
 */
export async function awsRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      attempt++;

      const shouldRetry = opts.retryIf ? opts.retryIf(error) : isRetriableError(error);

      if (!shouldRetry || attempt > opts.maxRetries) {
        throw error;
      }

      // Compute exponential backoff + jitter
      const expDelay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * opts.jitterMs;
      const delay = Math.min(opts.maxDelayMs, expDelay + jitter);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
