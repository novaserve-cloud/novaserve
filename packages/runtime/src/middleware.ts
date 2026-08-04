/**
 * Middleware System
 *
 * Composable middleware chain for handler functions.
 */

import { NovaContext } from "./context.js";
import { NovaResponse } from "./response.js";
import type { NovaHandler } from "./handler.js";

/** Next function in the middleware chain */
export type NextFunction = () => Promise<NovaResponse | void>;

/** Middleware function signature */
export type MiddlewareFunction = (
  ctx: NovaContext,
  next: NextFunction
) => Promise<NovaResponse | void>;

/** Middleware configuration */
export interface MiddlewareConfig {
  /** Middleware name (for debugging) */
  name: string;
  /** The middleware function */
  handler: MiddlewareFunction;
}

/**
 * Create a named middleware.
 *
 * @example
 * ```ts
 * const authMiddleware = createMiddleware({
 *   name: "auth",
 *   handler: async (ctx, next) => {
 *     const token = ctx.bearerToken();
 *     if (!token) return ctx.unauthorized();
 *     // Verify token...
 *     return next();
 *   },
 * });
 * ```
 */
export function createMiddleware(config: MiddlewareConfig): MiddlewareConfig {
  return config;
}

/**
 * Compose multiple middlewares into a single handler.
 *
 * @example
 * ```ts
 * const handler = composeMiddleware(
 *   [logMiddleware, authMiddleware, rateLimitMiddleware],
 *   async (ctx) => {
 *     return ctx.json({ message: "Hello!" });
 *   }
 * );
 * ```
 */
export function composeMiddleware(
  middlewares: MiddlewareConfig[],
  handler: NovaHandler
): NovaHandler {
  return async (ctx: NovaContext) => {
    let index = -1;

    const dispatch = async (i: number): Promise<NovaResponse | void> => {
      if (i <= index) {
        throw new Error("[NovaServe] next() called multiple times in middleware");
      }
      index = i;

      if (i < middlewares.length) {
        const middleware = middlewares[i]!;
        return middleware.handler(ctx, () => dispatch(i + 1));
      }

      // End of middleware chain — call the actual handler
      const result = await handler(ctx);

      if (result instanceof NovaResponse) {
        return result;
      }
      if (typeof result === "string") {
        return ctx.text(result);
      }
      if (result && typeof result === "object") {
        return ctx.json(result as Record<string, unknown>);
      }
      return ctx.json({ ok: true });
    };

    return (await dispatch(0)) as NovaResponse;
  };
}
