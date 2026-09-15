/**
 * Cloudflare Environment Isolation Manager
 *
 * Ensures staging, development, and production environments use
 * independently named resources. Prevents accidental cross-environment
 * resource access.
 */

export type CloudflareEnvironment = "development" | "staging" | "production" | string;

/**
 * Resolve the physical resource name for a given environment.
 *
 * Pattern: `{appName}-{baseName}-{environment}`
 *
 * Examples:
 *   resolveEnvironmentName("my-app", "cache", "production")  → "my-app-cache-production"
 *   resolveEnvironmentName("my-app", "cache", "staging")     → "my-app-cache-staging"
 *   resolveEnvironmentName("my-app", "cache", "development") → "my-app-cache-dev"
 */
export function resolveEnvironmentName(
  appName: string,
  baseName: string,
  environment: CloudflareEnvironment
): string {
  const envSuffix = normalizeEnvironmentSuffix(environment);
  const sanitized = sanitizeResourceName(`${appName}-${baseName}-${envSuffix}`);
  return sanitized;
}

/**
 * Resolve the Worker script name for a given environment.
 *
 * Pattern: `{appName}-{environment}`
 *
 * Examples:
 *   resolveWorkerName("my-api", "production")  → "my-api-production"
 *   resolveWorkerName("my-api", "staging")     → "my-api-staging"
 */
export function resolveWorkerName(
  appName: string,
  environment: CloudflareEnvironment
): string {
  const envSuffix = normalizeEnvironmentSuffix(environment);
  return sanitizeResourceName(`${appName}-${envSuffix}`);
}

/**
 * Check if the target environment is a production environment.
 *
 * Used to gate destructive operations and enforce safety checks.
 */
export function isProductionEnvironment(
  environment: CloudflareEnvironment
): boolean {
  const normalized = environment.toLowerCase().trim();
  return normalized === "production" || normalized === "prod";
}

/**
 * Validate that a local development operation is not accidentally
 * targeting production resources.
 */
export function validateEnvironmentSafety(
  targetEnv: CloudflareEnvironment,
  operation: string
): { safe: boolean; warning?: string } {
  if (isProductionEnvironment(targetEnv)) {
    return {
      safe: false,
      warning:
        `Operation "${operation}" targets production environment. ` +
        `Use --env staging for testing, or --force to confirm production.`,
    };
  }
  return { safe: true };
}

/**
 * Merge base environment variables with environment-specific overrides.
 *
 * Environment-specific values take precedence over base values.
 */
export function mergeEnvironmentVars(
  baseVars: Record<string, string>,
  envVars: Record<string, string>
): Record<string, string> {
  return { ...baseVars, ...envVars };
}

/**
 * Merge base secrets with environment-specific secrets.
 *
 * Deduplicates and combines both sets.
 */
export function mergeEnvironmentSecrets(
  baseSecrets: string[],
  envSecrets: string[]
): string[] {
  return [...new Set([...baseSecrets, ...envSecrets])];
}

/**
 * Get a short environment suffix for resource naming.
 */
function normalizeEnvironmentSuffix(
  environment: CloudflareEnvironment
): string {
  const normalized = environment.toLowerCase().trim();

  switch (normalized) {
    case "development":
    case "dev":
      return "dev";
    case "staging":
    case "stg":
      return "staging";
    case "production":
    case "prod":
      return "production";
    case "preview":
      return "preview";
    default:
      return normalized;
  }
}

/**
 * Sanitize a string for use as a Cloudflare resource name.
 *
 * - Lowercase
 * - Replace invalid characters with hyphens
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 * - Truncate to 63 characters (Cloudflare limit)
 */
function sanitizeResourceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}
