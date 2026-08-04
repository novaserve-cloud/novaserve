/**
 * API Resource Builder
 *
 * Define API Gateway routes with zero configuration.
 * Routes map HTTP methods + paths to handler functions.
 */

import type { ResourceDefinition } from "../app.js";

/** Route map: "METHOD /path" → "src/file.handler" */
export type RouteMap = Record<string, string>;

/** CORS configuration */
export interface CorsConfig {
  /** Allowed origins (default: "*") */
  origins?: string[];
  /** Allowed HTTP methods */
  methods?: string[];
  /** Allowed headers */
  headers?: string[];
  /** Max age for preflight cache in seconds */
  maxAge?: number;
}

/** API resource configuration */
export interface ApiConfig {
  /** Route definitions: "GET /users" → "src/handlers/users.list" */
  routes: RouteMap;
  /** Enable CORS (true for defaults, or provide config) */
  cors?: boolean | CorsConfig;
  /** Authentication mode */
  auth?: "none" | "jwt" | "api-key" | "oauth" | "custom";
  /** Custom domain */
  domain?: string;
  /** Rate limiting (requests per second) */
  rateLimit?: number;
  /** API description */
  description?: string;
  /** Base path prefix */
  basePath?: string;
  /** Default memory for route handlers (MB) */
  memory?: number;
  /** Default timeout for route handlers (seconds) */
  timeout?: number;
}

/** Resolved API resource */
export interface ApiResource extends ResourceDefinition {
  readonly _type: "api";
  readonly _config: ApiConfig & Record<string, unknown>;
}

/**
 * API resource builder.
 *
 * @example
 * ```ts
 * api.create({
 *   routes: {
 *     "GET /users": "src/handlers/users.list",
 *     "POST /users": "src/handlers/users.create",
 *     "GET /users/:id": "src/handlers/users.get",
 *   },
 *   cors: true,
 *   auth: "jwt",
 * })
 * ```
 */
export const api = {
  create(config: ApiConfig): ApiResource {
    // Validate routes
    if (!config.routes || Object.keys(config.routes).length === 0) {
      throw new Error("[NovaServe] API requires at least one route");
    }

    for (const [route, handler] of Object.entries(config.routes)) {
      const parts = route.split(" ");
      if (parts.length !== 2) {
        throw new Error(
          `[NovaServe] Invalid route "${route}". Use format "METHOD /path" (e.g., "GET /users")`
        );
      }

      const [method] = parts;
      const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "ANY"];
      if (!validMethods.includes(method!.toUpperCase())) {
        throw new Error(
          `[NovaServe] Invalid HTTP method "${method}" in route "${route}". Valid: ${validMethods.join(", ")}`
        );
      }

      if (!handler || typeof handler !== "string") {
        throw new Error(
          `[NovaServe] Route "${route}" handler must be a string path (e.g., "src/handlers/users.list")`
        );
      }
    }

    // Normalize CORS
    const cors: CorsConfig | false =
      config.cors === true
        ? { origins: ["*"], methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], maxAge: 86400 }
        : config.cors === false || config.cors === undefined
          ? false
          : config.cors;

    return {
      _type: "api",
      _name: "api",
      _config: {
        ...config,
        cors,
      } as ApiConfig & Record<string, unknown>,
    };
  },
};
