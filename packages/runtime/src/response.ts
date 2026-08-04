/**
 * Response Builder
 *
 * Immutable response object returned from handler functions.
 */

export class NovaResponse {
  constructor(
    readonly body: string,
    readonly status: number = 200,
    readonly headers: Record<string, string> = {}
  ) {}

  /** Create a new response with an additional header */
  withHeader(key: string, value: string): NovaResponse {
    return new NovaResponse(this.body, this.status, {
      ...this.headers,
      [key]: value,
    });
  }

  /** Create a new response with a different status code */
  withStatus(status: number): NovaResponse {
    return new NovaResponse(this.body, status, this.headers);
  }

  /** Create a new response with cache-control header */
  withCache(maxAge: number): NovaResponse {
    return this.withHeader("Cache-Control", `public, max-age=${maxAge}`);
  }

  /** Create a new response with no-cache header */
  withNoCache(): NovaResponse {
    return this.withHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  // ── Static Factories ────────────────────────────────

  static json(data: unknown, status = 200): NovaResponse {
    return new NovaResponse(JSON.stringify(data), status, {
      "Content-Type": "application/json",
    });
  }

  static text(data: string, status = 200): NovaResponse {
    return new NovaResponse(data, status, {
      "Content-Type": "text/plain",
    });
  }

  static html(data: string, status = 200): NovaResponse {
    return new NovaResponse(data, status, {
      "Content-Type": "text/html",
    });
  }

  static redirect(url: string, status = 302): NovaResponse {
    return new NovaResponse("", status, { Location: url });
  }

  static noContent(): NovaResponse {
    return new NovaResponse("", 204);
  }
}
