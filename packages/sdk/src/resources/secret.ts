/**
 * Secret Resource Builder
 *
 * Define application secrets with encrypted storage.
 * Secrets are encrypted locally and synced to the provider's secret manager.
 */

import type { ResourceDefinition } from "../app.js";

/** Secret configuration */
export interface SecretConfig {
  /** Description of the secret */
  description?: string;
  /** Secret is required for the app to function */
  required?: boolean;
  /** Default value (used in development only, never deployed) */
  devDefault?: string;
}

/** Resolved secret resource */
export interface SecretResource extends ResourceDefinition {
  readonly _type: "secret";
  readonly _config: SecretConfig & Record<string, unknown>;
}

/**
 * Secret resource builder.
 *
 * @example
 * ```ts
 * // Define secrets
 * secret.define("DATABASE_URL", { required: true })
 * secret.define("STRIPE_KEY", {
 *   description: "Stripe API key for payments",
 *   required: true,
 * })
 * secret.define("DEBUG_MODE", {
 *   devDefault: "true",
 * })
 * ```
 */
export const secret = {
  define(name: string, config: SecretConfig = {}): SecretResource {
    if (!name) {
      throw new Error("[NovaServe] Secret name is required");
    }

    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      throw new Error(
        `[NovaServe] Secret name "${name}" must be uppercase with underscores (e.g., DATABASE_URL)`
      );
    }

    return {
      _type: "secret",
      _name: name,
      _config: {
        required: true,
        ...config,
      } as SecretConfig & Record<string, unknown>,
    };
  },
};
