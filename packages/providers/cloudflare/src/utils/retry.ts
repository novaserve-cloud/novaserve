/**
 * Cloudflare Retry Engine — Rate Limit (429) & Server Error (5xx) Retry
 *
 * Implements exponential backoff with full jitter for Cloudflare API v4 requests.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export async function cloudflareRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 10000;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;

      const isRetryable = isCloudflareRetryableError(err);

      if (!isRetryable || attempt > maxRetries) {
        throw err;
      }

      const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitterDelay = Math.floor(Math.random() * expDelay);

      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }
}

function isCloudflareRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("econnreset")) {
      return true;
    }
  }
  return false;
}
