/**
 * Azure Retry Engine with Exponential Backoff & Full Jitter
 *
 * Implements production-grade retry policies for transient Azure Resource Manager
 * rate limits (429), 5xx server errors, socket disconnects, and RBAC role assignment
 * eventual consistency propagation.
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

/** Check whether an Azure ARM error is transient and safe to retry */
export function isAzureRetriableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errName = (error as any).name || "";
  const errCode = (error as any).code || (error as any).Code || "";
  const errMsg = (error as any).message || "";
  const statusCode = (error as any).statusCode || (error as any).$metadata?.httpStatusCode || 0;

  // Azure ARM Rate Limiting (429 Too Many Requests)
  if (statusCode === 429 || errCode === "TooManyRequests" || errName === "RestError" && statusCode === 429) {
    return true;
  }

  // Azure Server 5xx Errors
  if (statusCode >= 500 && statusCode < 600) {
    return true;
  }

  // Network Failure & Socket Disconnects
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
    errMsg.includes("network timeout")
  ) {
    return true;
  }

  // Azure RBAC & Resource Manager Eventual Consistency
  if (
    errCode === "RoleAssignmentExists" ||
    errCode === "ResourceGroupNotFound" ||
    errMsg.includes("PrincipalNotFound") ||
    errMsg.includes("The role assignment already exists") ||
    errMsg.includes("Conflict")
  ) {
    return true;
  }

  return false;
}

/**
 * Execute an async Azure SDK call with exponential backoff & full jitter
 */
export async function azureRetry<T>(
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

      const shouldRetry = opts.retryIf ? opts.retryIf(error) : isAzureRetriableError(error);

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
