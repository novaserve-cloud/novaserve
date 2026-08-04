/**
 * Request Context
 *
 * Provides a clean API for handler functions to access
 * request data, resource bindings, and response helpers.
 */

import { NovaResponse } from "./response.js";

export class NovaContext {
  /** Raw event from the cloud provider */
  readonly rawEvent: unknown;
  /** Raw provider context */
  readonly rawContext: unknown;
  
  /** Observability: Basic logger */
  readonly logger: {
    info: (msg: string, meta?: any) => void;
    error: (msg: string, meta?: any) => void;
  };

  /** Observability: Request Trace ID */
  readonly traceId: string;

  // ── Request Properties ──────────────────────────────

  /** HTTP method */
  readonly method: string;
  /** Request path */
  readonly path: string;
  /** URL parameters (e.g., /users/:id → { id: "123" }) */
  readonly params: Record<string, string>;
  /** Query string parameters */
  readonly query: Record<string, string>;
  /** Request headers */
  readonly headers: Record<string, string>;

  private _body: unknown;

  constructor(
    event: unknown,
    context: unknown,
    options: { parseBody?: boolean } = {}
  ) {
    this.rawEvent = event;
    this.rawContext = context;
    
    this.traceId = Math.random().toString(36).substring(2, 15);
    
    this.logger = {
      info: (msg, meta) => console.log(JSON.stringify({ level: 'INFO', traceId: this.traceId, msg, meta })),
      error: (msg, meta) => console.error(JSON.stringify({ level: 'ERROR', traceId: this.traceId, msg, meta }))
    };

    // Normalize event format across providers
    const evt = event as Record<string, unknown>;
    const reqContext = (evt.requestContext as Record<string, unknown>) || {};
    const httpContext = (reqContext.http as Record<string, unknown>) || {};

    this.method = (evt.httpMethod as string) || (httpContext.method as string) || "GET";
    this.path = (evt.path as string) || (evt.rawPath as string) || "/";
    this.params = (evt.pathParameters as Record<string, string>) || {};
    this.query = (evt.queryStringParameters as Record<string, string>) || {};

    // Normalize headers to lowercase
    const rawHeaders = (evt.headers as Record<string, string>) || {};
    this.headers = {};
    for (const [key, value] of Object.entries(rawHeaders)) {
      this.headers[key.toLowerCase()] = value;
    }

    // Parse body
    if (options.parseBody !== false && evt.body) {
      try {
        this._body =
          typeof evt.body === "string" ? JSON.parse(evt.body) : evt.body;
      } catch {
        this._body = evt.body;
      }
    }
  }

  // ── Body Access ─────────────────────────────────────

  /** Get the parsed request body */
  body<T = unknown>(): T {
    return this._body as T;
  }

  /** Get a specific field from the body */
  input<T = unknown>(key: string, defaultValue?: T): T {
    const body = this._body as Record<string, unknown> | undefined;
    return (body?.[key] as T) ?? defaultValue as T;
  }

  // ── Response Helpers ────────────────────────────────

  /** Return a JSON response */
  json(data: Record<string, unknown> | unknown[], statusCode = 200): NovaResponse {
    return new NovaResponse(JSON.stringify(data), statusCode, {
      "Content-Type": "application/json",
    });
  }

  /** Return a plain text response */
  text(data: string, statusCode = 200): NovaResponse {
    return new NovaResponse(data, statusCode, {
      "Content-Type": "text/plain",
    });
  }

  /** Return an HTML response */
  html(data: string, statusCode = 200): NovaResponse {
    return new NovaResponse(data, statusCode, {
      "Content-Type": "text/html",
    });
  }

  /** Return a redirect response */
  redirect(url: string, statusCode = 302): NovaResponse {
    return new NovaResponse("", statusCode, {
      Location: url,
    });
  }

  /** Return an error response */
  error(message: string, statusCode = 500): NovaResponse {
    return new NovaResponse(
      JSON.stringify({ error: message, statusCode }),
      statusCode,
      { "Content-Type": "application/json" }
    );
  }

  /** Return a 404 Not Found response */
  notFound(message = "Not Found"): NovaResponse {
    return this.error(message, 404);
  }

  /** Return a 400 Bad Request response */
  badRequest(message = "Bad Request"): NovaResponse {
    return this.error(message, 400);
  }

  /** Return a 401 Unauthorized response */
  unauthorized(message = "Unauthorized"): NovaResponse {
    return this.error(message, 401);
  }

  // ── Header Helpers ──────────────────────────────────

  /** Get a specific header value */
  header(key: string): string | undefined {
    return this.headers[key.toLowerCase()];
  }

  /** Get the Authorization bearer token */
  bearerToken(): string | undefined {
    const auth = this.header("authorization");
    if (auth?.startsWith("Bearer ")) {
      return auth.slice(7);
    }
    return undefined;
  }

  /** Get the Content-Type header */
  contentType(): string | undefined {
    return this.header("content-type");
  }
}
