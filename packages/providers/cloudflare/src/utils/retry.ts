/**
 * Cloudflare Retry Engine — Rate Limit (429) & Server Error (5xx) Retry
 *
 * Implements exponential backoff with full jitter for Cloudflare API v4 requests.
 * Respects Retry-After headers, differentiates destructive vs. safe operations,
 * and throws typed errors on exhaustion.
 */

import {
  CloudflareRateLimitError,
  CloudflareNetworkError,
} from "../errors.js";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Base delay in ms (default: 500) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 15000) */
  maxDelayMs?: number;
  /** Whether this is a destructive operation (no retry if true) */
  isDestructive?: boolean;
}

/**
 * Execute a function with exponential backoff retry for transient Cloudflare errors.
 *
 * Features:
 * - Exponential backoff with full jitter
 * - Respects Retry-After from CloudflareRateLimitError
 * - Skips retry for destructive operations
 * - Typed error on exhaustion
 */
export async function cloudflareRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 15000;
  const isDestructive = options.isDestructive ?? false;

  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;

      // Never retry destructive operations
      if (isDestructive) {
        throw err;
      }

      const retryable = isCloudflareRetryableError(err);

      if (!retryable || attempt > maxRetries) {
        // If it was a rate limit and we've exhausted retries, ensure typed error
        if (
          retryable &&
          attempt > maxRetries &&
          err instanceof CloudflareRateLimitError
        ) {
          throw err;
        }
        throw err;
      }

      // Calculate delay
      let delayMs: number;

      // If it's a rate limit error with retryAfterSeconds, use that
      if (
        err instanceof CloudflareRateLimitError &&
        err.retryAfterSeconds
      ) {
        delayMs = Math.min(err.retryAfterSeconds * 1000, maxDelayMs);
      } else {
        // Exponential backoff with full jitter
        const expDelay = Math.min(
          maxDelayMs,
          baseDelayMs * Math.pow(2, attempt - 1)
        );
        delayMs = Math.floor(Math.random() * expDelay);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Determine if an error is retryable.
 *
 * Retryable errors:
 * - HTTP 429 (Rate Limited)
 * - HTTP 500, 502, 503, 504 (Server Errors)
 * - Network errors (ECONNRESET, ETIMEDOUT, etc.)
 *
 * Non-retryable errors:
 * - HTTP 400 (Bad Request)
 * - HTTP 401 (Unauthorized)
 * - HTTP 403 (Forbidden)
 * - HTTP 404 (Not Found)
 * - HTTP 409 (Conflict)
 */
function isCloudflareRetryableError(err: unknown): boolean {
  // Typed rate limit errors are always retryable
  if (err instanceof CloudflareRateLimitError) {
    return true;
  }

  // Typed network errors are always retryable
  if (err instanceof CloudflareNetworkError) {
    return true;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // Rate limiting
    if (msg.includes("429") || msg.includes("rate limit")) {
      return true;
    }

    // Server errors
    if (
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("server error")
    ) {
      return true;
    }

    // Network-level errors
    if (
      msg.includes("econnreset") ||
      msg.includes("enotfound") ||
      msg.includes("etimedout") ||
      msg.includes("econnrefused") ||
      msg.includes("fetch failed") ||
      msg.includes("abort") ||
      msg.includes("socket hang up")
    ) {
      return true;
    }
  }

  return false;
}
