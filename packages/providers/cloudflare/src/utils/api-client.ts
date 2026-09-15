/**
 * Cloudflare API Client — Centralized HTTP Client for Cloudflare API v4
 *
 * Single entry point for all Cloudflare REST API interactions.
 * Handles authentication, response parsing, error mapping, retry logic,
 * and credential sanitization.
 *
 * All services use this client instead of raw `fetch`.
 */

import type { CloudflareApiResponse } from "../types.js";
import {
  CloudflareAuthenticationError,
  CloudflareNetworkError,
  CloudflareRateLimitError,
  mapCloudflareApiError,
  sanitizeErrorMessage,
} from "../errors.js";
import { cloudflareRetry } from "./retry.js";

export interface ApiClientOptions {
  /** Cloudflare API Token */
  apiToken: string;
  /** Cloudflare Account ID */
  accountId: string;
  /** Base URL override (for testing) */
  baseUrl?: string;
  /** Maximum retries for transient failures */
  maxRetries?: number;
  /** User-Agent header */
  userAgent?: string;
}

export interface RequestOptions {
  /** Override the default retry count */
  maxRetries?: number;
  /** Whether this is a destructive operation (disables retry) */
  isDestructive?: boolean;
  /** Resource name for error context */
  resource?: string;
  /** Environment for error context */
  environment?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

/**
 * Centralized Cloudflare API v4 HTTP client.
 *
 * Usage:
 * ```typescript
 * const client = new CloudflareApiClient({ apiToken, accountId });
 * const buckets = await client.get<R2Bucket[]>("/r2/buckets", "listBuckets");
 * await client.post("/r2/buckets", "createBucket", { name: "my-bucket" });
 * ```
 */
export class CloudflareApiClient {
  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly userAgent: string;

  constructor(options: ApiClientOptions) {
    this.apiToken = options.apiToken;
    this.accountId = options.accountId;
    this.baseUrl =
      options.baseUrl ||
      `https://api.cloudflare.com/client/v4/accounts/${options.accountId}`;
    this.maxRetries = options.maxRetries ?? 5;
    this.userAgent = options.userAgent || "NovaServe-Cloudflare-Provider/3.0.0";
  }

  get token(): string {
    return this.apiToken;
  }

  get account(): string {
    return this.accountId;
  }

  // ── HTTP Methods ────────────────────────────────────────────

  async get<T = unknown>(
    path: string,
    operation: string,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, operation, options);
  }

  async post<T = unknown>(
    path: string,
    operation: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("POST", path, body, operation, options);
  }

  async put<T = unknown>(
    path: string,
    operation: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("PUT", path, body, operation, options);
  }

  async patch<T = unknown>(
    path: string,
    operation: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("PATCH", path, body, operation, options);
  }

  async delete<T = unknown>(
    path: string,
    operation: string,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("DELETE", path, undefined, operation, {
      ...options,
      isDestructive: true,
    });
  }

  /**
   * Upload multipart form data (used for Worker script uploads).
   * Bypasses JSON body serialization.
   */
  async uploadForm<T = unknown>(
    path: string,
    operation: string,
    formData: FormData,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.resolveUrl(path);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      "User-Agent": this.userAgent,
      ...options?.headers,
    };
    // Do NOT set Content-Type for FormData — fetch auto-sets multipart boundary

    const retries = options?.maxRetries ?? this.maxRetries;

    return cloudflareRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          options?.timeoutMs ?? 60000
        );

        try {
          const res = await fetch(url, {
            method: "PUT",
            headers,
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          return this.handleResponse<T>(
            res,
            operation,
            options?.resource,
            options?.environment
          );
        } catch (err) {
          clearTimeout(timeoutId);
          throw this.handleFetchError(
            err,
            operation,
            options?.resource,
            options?.environment
          );
        }
      },
      { maxRetries: retries, isDestructive: false }
    );
  }

  // ── Unscoped Requests (outside /accounts/{id}/) ─────────────

  /**
   * Make a request to a Cloudflare API path that is NOT scoped to /accounts/{id}/.
   * Used for endpoints like /user/tokens/verify.
   */
  async requestUnscoped<T = unknown>(
    method: string,
    absolutePath: string,
    operation: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `https://api.cloudflare.com/client/v4${absolutePath}`;
    return this.executeRequest<T>(
      method,
      url,
      body,
      operation,
      options
    );
  }

  // ── Internal Request Engine ─────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    operation: string,
    options?: RequestOptions
  ): Promise<T> {
    const url = this.resolveUrl(path);
    return this.executeRequest<T>(method, url, body, operation, options);
  }

  private async executeRequest<T>(
    method: string,
    url: string,
    body: unknown | undefined,
    operation: string,
    options?: RequestOptions
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": this.userAgent,
      ...options?.headers,
    };

    const retries = options?.isDestructive ? 0 : (options?.maxRetries ?? this.maxRetries);

    return cloudflareRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          options?.timeoutMs ?? 30000
        );

        try {
          const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          return this.handleResponse<T>(
            res,
            operation,
            options?.resource,
            options?.environment
          );
        } catch (err) {
          clearTimeout(timeoutId);
          throw this.handleFetchError(
            err,
            operation,
            options?.resource,
            options?.environment
          );
        }
      },
      { maxRetries: retries, isDestructive: options?.isDestructive ?? false }
    );
  }

  // ── Response Handling ───────────────────────────────────────

  private async handleResponse<T>(
    res: Response,
    operation: string,
    resource?: string,
    environment?: string
  ): Promise<T> {
    // Handle 204 No Content (common for DELETE)
    if (res.status === 204) {
      return undefined as unknown as T;
    }

    // Handle rate limiting
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
      throw new CloudflareRateLimitError({
        message: "Cloudflare API rate limit exceeded",
        operation,
        resource,
        environment,
        retryAfterSeconds: Number.isNaN(retryAfterSeconds) ? undefined : retryAfterSeconds,
      });
    }

    let body: CloudflareApiResponse<T>;
    try {
      body = (await res.json()) as CloudflareApiResponse<T>;
    } catch {
      // Non-JSON response
      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw mapCloudflareApiError(
          res.status,
          sanitizeErrorMessage(text),
          operation,
          resource,
          environment
        );
      }
      return undefined as unknown as T;
    }

    // Cloudflare API envelope: check `success` field
    if (!body.success) {
      const errorMessages = (body.errors || [])
        .map((e) => sanitizeErrorMessage(e.message))
        .join("; ");
      const message = errorMessages || `API request failed with status ${res.status}`;

      throw mapCloudflareApiError(
        res.status,
        message,
        operation,
        resource,
        environment
      );
    }

    return body.result;
  }

  private handleFetchError(
    err: unknown,
    operation: string,
    resource?: string,
    environment?: string
  ): Error {
    if (err instanceof CloudflareRateLimitError) {
      return err;
    }

    const message = err instanceof Error ? err.message : String(err);

    // Aborted (timeout)
    if (message.includes("abort") || message.includes("AbortError")) {
      return new CloudflareNetworkError({
        message: "Request timed out while connecting to Cloudflare API",
        operation,
        resource,
        environment,
        cause: err instanceof Error ? err : undefined,
      });
    }

    // Network-level failures
    if (
      message.includes("ECONNRESET") ||
      message.includes("ENOTFOUND") ||
      message.includes("ETIMEDOUT") ||
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed")
    ) {
      return new CloudflareNetworkError({
        message: `Network error connecting to Cloudflare API: ${sanitizeErrorMessage(message)}`,
        operation,
        resource,
        environment,
        cause: err instanceof Error ? err : undefined,
      });
    }

    // Re-throw typed errors as-is
    if (err instanceof Error && err.name.startsWith("Cloudflare")) {
      return err;
    }

    return new CloudflareNetworkError({
      message: `Unexpected error during Cloudflare API call: ${sanitizeErrorMessage(message)}`,
      operation,
      resource,
      environment,
      cause: err instanceof Error ? err : undefined,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────

  private resolveUrl(path: string): string {
    // If path starts with /, it's absolute to the account base
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${this.baseUrl}/${cleanPath}`;
  }

  /** Get standard auth headers (for external use, e.g. FormData uploads) */
  getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": this.userAgent,
    };
  }
}
