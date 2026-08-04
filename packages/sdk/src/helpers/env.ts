/**
 * Environment Helpers
 *
 * Type-safe environment variable access with validation.
 */

/**
 * Get an environment variable with type safety.
 *
 * @example
 * ```ts
 * const dbUrl = env.get("DATABASE_URL");        // string | undefined
 * const port = env.require("PORT");             // string (throws if missing)
 * const debug = env.bool("DEBUG", false);       // boolean with default
 * const workers = env.number("WORKERS", 4);     // number with default
 * ```
 */
export const env = {
  /** Get an environment variable (returns undefined if not set) */
  get(key: string): string | undefined {
    return process.env[key];
  },

  /** Get a required environment variable (throws if missing) */
  require(key: string): string {
    const value = process.env[key];
    if (value === undefined || value === "") {
      throw new Error(
        `[NovaServe] Required environment variable "${key}" is not set. ` +
          `Set it with: nova env set ${key} <value>`
      );
    }
    return value;
  },

  /** Get a boolean environment variable */
  bool(key: string, defaultValue = false): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value === "true" || value === "1" || value === "yes";
  },

  /** Get a numeric environment variable */
  number(key: string, defaultValue = 0): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const num = Number(value);
    if (Number.isNaN(num)) {
      throw new Error(`[NovaServe] Environment variable "${key}" is not a valid number: "${value}"`);
    }
    return num;
  },

  /** Get a JSON-parsed environment variable */
  json<T = unknown>(key: string, defaultValue?: T): T {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`[NovaServe] Environment variable "${key}" is not set`);
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      throw new Error(`[NovaServe] Environment variable "${key}" is not valid JSON`);
    }
  },

  /** Get an environment variable with a list of allowed values */
  oneOf<T extends string>(key: string, allowed: T[], defaultValue?: T): T {
    const value = (process.env[key] ?? defaultValue) as T | undefined;
    if (value === undefined) {
      throw new Error(`[NovaServe] Environment variable "${key}" is not set`);
    }
    if (!allowed.includes(value)) {
      throw new Error(
        `[NovaServe] Environment variable "${key}" must be one of: ${allowed.join(", ")}. Got: "${value}"`
      );
    }
    return value;
  },
};
