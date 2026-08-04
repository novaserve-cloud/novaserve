/**
 * Universal Handler
 *
 * Wraps user functions with a consistent interface.
 * Handles request parsing, response formatting, and error handling.
 */

import { NovaContext } from "./context.js";
import { NovaResponse } from "./response.js";

/** The function signature that users write */
export type NovaHandler = (ctx: NovaContext) => Promise<NovaResponse | Record<string, unknown> | string | void>;

/** Handler configuration */
export interface HandlerConfig {
  /** Enable request body parsing (default: true) */
  parseBody?: boolean;
  /** Enable CORS headers (default: true) */
  cors?: boolean;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Create a NovaServe handler from a user function.
 *
 * This is the bridge between user code and cloud provider runtimes.
 * It normalizes the event format across providers.
 *
 * @example
 * ```ts
 * export const handler = createHandler(async (ctx) => {
 *   const users = await fetchUsers();
 *   return ctx.json({ users });
 * });
 * ```
 */
export function createHandler(
  fn: NovaHandler,
  config: HandlerConfig = {}
): (event: unknown, context?: unknown) => Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const { parseBody = true, cors = true } = config;

  return async (event: unknown, providerContext?: unknown) => {
    const startTime = Date.now();
    const ctx = new NovaContext(event, providerContext, { parseBody });

    try {
      const result = await fn(ctx);

      // Handle different return types
      let response: NovaResponse;

      if (result instanceof NovaResponse) {
        response = result;
      } else if (typeof result === "string") {
        response = ctx.text(result);
      } else if (result && typeof result === "object") {
        response = ctx.json(result as Record<string, unknown>);
      } else {
        response = ctx.json({ ok: true });
      }

      const headers: Record<string, string> = {
        ...response.headers,
        "X-Nova-Duration": `${Date.now() - startTime}ms`,
      };

      // Add CORS headers
      if (cors) {
        headers["Access-Control-Allow-Origin"] = "*";
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
      }

      return {
        statusCode: response.status,
        headers,
        body: response.body,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal Server Error";
      const statusCode = (error as { statusCode?: number }).statusCode || 500;

      console.error("[NovaServe] Handler error:", error);

      return {
        statusCode,
        headers: {
          "Content-Type": "application/json",
          "X-Nova-Duration": `${Date.now() - startTime}ms`,
        },
        body: JSON.stringify({
          error: message,
          statusCode,
          timestamp: new Date().toISOString(),
        }),
      };
    }
  };
}
