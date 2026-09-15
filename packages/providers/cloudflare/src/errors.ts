/**
 * Cloudflare Provider — Structured Error Hierarchy
 *
 * Production-grade error classes that provide actionable context
 * for every Cloudflare API failure. Errors never expose API tokens
 * or sensitive credential information.
 */

/**
 * Base error class for all Cloudflare provider errors.
 * Contains structured context for logging and debugging.
 */
export class CloudflareError extends Error {
  readonly provider = "cloudflare" as const;
  readonly operation: string;
  readonly resource?: string;
  readonly environment?: string;
  readonly statusCode?: number;
  readonly actionableMessage: string;

  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    statusCode?: number;
    actionableMessage?: string;
    cause?: Error;
  }) {
    const fullMessage = formatErrorMessage(options);
    super(sanitizeErrorMessage(fullMessage));
    this.name = "CloudflareError";
    this.operation = options.operation;
    this.resource = options.resource;
    this.environment = options.environment;
    this.statusCode = options.statusCode;
    this.actionableMessage = sanitizeErrorMessage(options.actionableMessage || options.message);
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /** Return a structured JSON representation safe for logging (no secrets) */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      provider: this.provider,
      operation: this.operation,
      resource: this.resource,
      environment: this.environment,
      statusCode: this.statusCode,
      message: this.actionableMessage,
    };
  }
}

/**
 * Thrown when Cloudflare API credentials are invalid or missing.
 *
 * Common causes:
 * - Missing CLOUDFLARE_API_TOKEN environment variable
 * - Missing CLOUDFLARE_ACCOUNT_ID environment variable
 * - Expired or revoked API token
 */
export class CloudflareAuthenticationError extends CloudflareError {
  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    cause?: Error;
  }) {
    super({
      ...options,
      statusCode: 401,
      actionableMessage:
        options.message +
        "\n\nTo fix:\n" +
        "  1. Set CLOUDFLARE_API_TOKEN with a valid Cloudflare API token\n" +
        "  2. Set CLOUDFLARE_ACCOUNT_ID with your Cloudflare account ID\n" +
        "  3. Verify the token hasn't expired at https://dash.cloudflare.com/profile/api-tokens",
    });
    this.name = "CloudflareAuthenticationError";
  }
}

/**
 * Thrown when the API token lacks required permissions.
 *
 * Common causes:
 * - Token doesn't have Workers Scripts Edit permission
 * - Token doesn't have Account-level access for KV/R2/D1
 */
export class CloudflarePermissionError extends CloudflareError {
  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    cause?: Error;
  }) {
    super({
      ...options,
      statusCode: 403,
      actionableMessage:
        options.message +
        "\n\nTo fix:\n" +
        "  1. Edit your API token at https://dash.cloudflare.com/profile/api-tokens\n" +
        "  2. Ensure the token has the required permissions:\n" +
        "     - Workers Scripts: Edit\n" +
        "     - Workers KV Storage: Edit\n" +
        "     - Workers R2 Storage: Edit\n" +
        "     - D1: Edit\n" +
        "     - Account Settings: Read",
    });
    this.name = "CloudflarePermissionError";
  }
}

/**
 * Thrown when a referenced resource does not exist.
 */
export class CloudflareResourceNotFoundError extends CloudflareError {
  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    cause?: Error;
  }) {
    super({
      ...options,
      statusCode: 404,
      actionableMessage:
        options.message +
        "\n\nTo fix:\n" +
        "  1. Verify the resource name/ID is correct\n" +
        "  2. Check if the resource exists in the Cloudflare dashboard\n" +
        "  3. Ensure you're targeting the correct account and environment",
    });
    this.name = "CloudflareResourceNotFoundError";
  }
}

/**
 * Thrown when a resource already exists and cannot be re-created.
 * Note: Most operations are idempotent and handle this gracefully.
 */
export class CloudflareResourceExistsError extends CloudflareError {
  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    cause?: Error;
  }) {
    super({
      ...options,
      statusCode: 409,
      actionableMessage:
        options.message +
        "\n\nThis usually means the resource was created outside of NovaServe. " +
        "NovaServe will attempt to use the existing resource.",
    });
    this.name = "CloudflareResourceExistsError";
  }
}

/**
 * Thrown when a deployment operation fails.
 */
export class CloudflareDeploymentError extends CloudflareError {
  /** Resources that were successfully provisioned before failure (for cleanup) */
  readonly provisionedResources: string[];

  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    provisionedResources?: string[];
    cause?: Error;
  }) {
    super({
      ...options,
      actionableMessage:
        options.message +
        "\n\nTo investigate:\n" +
        "  1. Check deployment logs: nova deployment list\n" +
        "  2. Inspect the Cloudflare dashboard for partial deployments\n" +
        "  3. Run: nova deploy --env <environment> to retry",
    });
    this.name = "CloudflareDeploymentError";
    this.provisionedResources = options.provisionedResources || [];
  }
}

/**
 * Thrown when a D1 database migration fails.
 */
export class CloudflareMigrationError extends CloudflareError {
  /** The migration filename that failed */
  readonly migrationFile?: string;
  /** Migrations that were successfully applied before failure */
  readonly appliedMigrations: string[];

  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    migrationFile?: string;
    appliedMigrations?: string[];
    cause?: Error;
  }) {
    super({
      ...options,
      actionableMessage:
        options.message +
        (options.migrationFile
          ? `\n\nFailed migration: ${options.migrationFile}`
          : "") +
        "\n\nTo fix:\n" +
        "  1. Check the migration SQL for syntax errors\n" +
        "  2. Verify the migration is compatible with D1 (SQLite)\n" +
        "  3. Review applied migrations: nova resource list --type d1\n" +
        "  4. Fix the migration and re-run: nova deploy",
    });
    this.name = "CloudflareMigrationError";
    this.migrationFile = options.migrationFile;
    this.appliedMigrations = options.appliedMigrations || [];
  }
}

/**
 * Thrown when Cloudflare API rate limits are exceeded after retries.
 */
export class CloudflareRateLimitError extends CloudflareError {
  /** Seconds until the rate limit resets */
  readonly retryAfterSeconds?: number;

  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    retryAfterSeconds?: number;
    cause?: Error;
  }) {
    super({
      ...options,
      statusCode: 429,
      actionableMessage:
        options.message +
        (options.retryAfterSeconds
          ? `\n\nRate limit resets in ${options.retryAfterSeconds} seconds.`
          : "") +
        "\n\nTo fix:\n" +
        "  1. Wait and retry the operation\n" +
        "  2. Reduce the number of concurrent API calls\n" +
        "  3. Consider using a token with higher rate limits",
    });
    this.name = "CloudflareRateLimitError";
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/**
 * Thrown for network-level failures (connection refused, DNS, timeout).
 */
export class CloudflareNetworkError extends CloudflareError {
  constructor(options: {
    message: string;
    operation: string;
    resource?: string;
    environment?: string;
    cause?: Error;
  }) {
    super({
      ...options,
      actionableMessage:
        options.message +
        "\n\nTo fix:\n" +
        "  1. Check your internet connectivity\n" +
        "  2. Verify api.cloudflare.com is accessible\n" +
        "  3. Check if a proxy/firewall is blocking outbound HTTPS\n" +
        "  4. Retry the operation",
    });
    this.name = "CloudflareNetworkError";
  }
}

// ── Helpers ───────────────────────────────────────────────────

function formatErrorMessage(options: {
  message: string;
  operation: string;
  resource?: string;
  environment?: string;
}): string {
  const parts: string[] = [
    `[Cloudflare] ${options.message}`,
    `  Operation: ${options.operation}`,
  ];
  if (options.resource) {
    parts.push(`  Resource:  ${options.resource}`);
  }
  if (options.environment) {
    parts.push(`  Environment: ${options.environment}`);
  }
  return parts.join("\n");
}

/**
 * Map a Cloudflare API HTTP status code and error body to the appropriate typed error.
 *
 * @param statusCode - HTTP response status code
 * @param errorMessage - Sanitized error message (must not contain API tokens)
 * @param operation - The operation that was being performed
 * @param resource - The target resource name/ID
 * @param environment - The target environment
 */
export function mapCloudflareApiError(
  statusCode: number,
  errorMessage: string,
  operation: string,
  resource?: string,
  environment?: string
): CloudflareError {
  const base = { message: errorMessage, operation, resource, environment };

  switch (statusCode) {
    case 400:
      return new CloudflareError({
        ...base,
        statusCode: 400,
        actionableMessage: `Bad request: ${errorMessage}. Check the resource configuration.`,
      });
    case 401:
      return new CloudflareAuthenticationError(base);
    case 403:
      return new CloudflarePermissionError(base);
    case 404:
      return new CloudflareResourceNotFoundError(base);
    case 409:
      return new CloudflareResourceExistsError(base);
    case 429:
      return new CloudflareRateLimitError(base);
    default:
      if (statusCode >= 500) {
        return new CloudflareError({
          ...base,
          statusCode,
          actionableMessage: `Cloudflare server error (${statusCode}): ${errorMessage}. Retry the operation.`,
        });
      }
      return new CloudflareError({ ...base, statusCode });
  }
}

/**
 * Sanitize an error message to remove any accidentally included API tokens.
 */
export function sanitizeErrorMessage(message: string): string {
  // Mask anything that looks like a Bearer token or Cloudflare API token
  return message
    .replace(/Bearer\s+[A-Za-z0-9_-]{20,}/gi, "Bearer ***MASKED***")
    .replace(
      /([A-Za-z0-9_-]{20,})/g,
      (match) => {
        // Only mask strings that look like API tokens (20+ chars, letters/digits)
        if (
          match.length >= 20 &&
          /[a-zA-Z]/.test(match) &&
          /[0-9]/.test(match)
        ) {
          return "***MASKED_TOKEN***";
        }
        return match;
      }
    );
}
