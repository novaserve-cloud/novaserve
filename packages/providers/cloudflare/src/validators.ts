/**
 * Cloudflare Provider — Input Validation
 *
 * Validates configuration values, resource names, and inputs
 * against Cloudflare constraints and security requirements.
 */

import type { Resource, ValidationResult } from "novaserve-core";
import type { CloudflareProviderConfig } from "./types.js";
import { CloudflareAuthManager } from "./utils/auth.js";

/**
 * Validate the Cloudflare provider configuration and resources.
 */
export function validateCloudflareConfig(
  resources: Resource[],
  config: CloudflareProviderConfig
): ValidationResult {
  const errors: Array<{ resource: string; message: string }> = [];
  const warnings: Array<{ resource: string; message: string }> = [];

  // ── Credential Validation ───────────────────────────────────
  const creds = CloudflareAuthManager.getCredentials(
    config as unknown as Record<string, unknown>
  );
  if (!creds.apiToken) {
    errors.push({
      resource: "provider",
      message:
        "Cloudflare API token not configured. " +
        "Set CLOUDFLARE_API_TOKEN environment variable or apiToken in config.",
    });
  }
  if (!creds.accountId) {
    errors.push({
      resource: "provider",
      message:
        "Cloudflare Account ID not configured. " +
        "Set CLOUDFLARE_ACCOUNT_ID environment variable or accountId in config.",
    });
  }

  // ── Worker Name Validation ──────────────────────────────────
  if (config.worker?.name) {
    const nameErrors = validateWorkerName(config.worker.name);
    for (const err of nameErrors) {
      errors.push({ resource: "worker", message: err });
    }
  }

  // ── Resource-Type Mapping Validation ────────────────────────
  for (const resource of resources) {
    switch (resource.type) {
      case "function":
      case "api":
      case "cron":
        // Maps to Cloudflare Worker
        break;

      case "storage":
        // Maps to R2
        warnings.push({
          resource: resource.name,
          message: "Mapped to Cloudflare R2 object storage bucket",
        });
        if (resource.name) {
          const bucketErrors = validateR2BucketName(resource.name);
          for (const err of bucketErrors) {
            errors.push({ resource: resource.name, message: err });
          }
        }
        break;

      case "database":
        // Maps to D1
        warnings.push({
          resource: resource.name,
          message:
            "Mapped to Cloudflare D1 (SQLite). " +
            "Original engine selection is ignored on Cloudflare.",
        });
        break;

      case "cache":
        // Maps to KV
        warnings.push({
          resource: resource.name,
          message:
            "Mapped to Cloudflare KV Namespace. " +
            "Redis eviction and exact TTL semantics are not fully supported.",
        });
        break;

      case "queue":
        // Maps to Cloudflare Queue
        break;

      case "secret":
        // Maps to Worker secret binding
        break;

      case "websocket":
        warnings.push({
          resource: resource.name,
          message:
            "WebSocket support on Cloudflare requires Durable Objects. " +
            "Basic WebSocket passthrough is available via Workers.",
        });
        break;

      case "cdn":
        warnings.push({
          resource: resource.name,
          message:
            "Cloudflare CDN is built-in. Static assets are served at the edge automatically.",
        });
        break;

      default:
        warnings.push({
          resource: resource.name,
          message: `Resource type "${resource.type}" has limited support on Cloudflare.`,
        });
    }
  }

  // ── KV Config Validation ────────────────────────────────────
  if (config.kv) {
    for (const kv of config.kv) {
      const bindingErrors = validateBindingName(kv.name);
      for (const err of bindingErrors) {
        errors.push({ resource: `kv:${kv.name}`, message: err });
      }
    }
  }

  // ── R2 Config Validation ────────────────────────────────────
  if (config.r2) {
    for (const r2 of config.r2) {
      const bindingErrors = validateBindingName(r2.name);
      for (const err of bindingErrors) {
        errors.push({ resource: `r2:${r2.name}`, message: err });
      }
      if (r2.bucketName) {
        const bucketErrors = validateR2BucketName(r2.bucketName);
        for (const err of bucketErrors) {
          errors.push({ resource: `r2:${r2.name}`, message: err });
        }
      }
    }
  }

  // ── D1 Config Validation ────────────────────────────────────
  if (config.d1) {
    for (const d1 of config.d1) {
      const bindingErrors = validateBindingName(d1.name);
      for (const err of bindingErrors) {
        errors.push({ resource: `d1:${d1.name}`, message: err });
      }
    }
  }

  // ── Route Validation ────────────────────────────────────────
  if (config.worker?.routes) {
    for (const route of config.worker.routes) {
      if (!route.pattern) {
        errors.push({
          resource: "routes",
          message: "Route pattern is required",
        });
      }
      const zoneId = route.zoneId || config.zoneId;
      if (!zoneId) {
        errors.push({
          resource: "routes",
          message:
            `Route "${route.pattern}" requires a Zone ID. ` +
            "Set CLOUDFLARE_ZONE_ID or configure zoneId in the route/provider config.",
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Individual Validators ─────────────────────────────────────

/**
 * Validate a Worker script name.
 * Rules: lowercase alphanumeric + hyphens, 1-63 chars, can't start/end with hyphen.
 */
export function validateWorkerName(name: string): string[] {
  const errors: string[] = [];

  if (!name) {
    errors.push("Worker name cannot be empty");
    return errors;
  }

  if (name.length > 63) {
    errors.push(`Worker name "${name}" exceeds 63 character limit (${name.length} chars)`);
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && name.length > 1) {
    errors.push(
      `Worker name "${name}" must contain only lowercase letters, numbers, and hyphens, ` +
        "and cannot start or end with a hyphen"
    );
  }

  if (name.length === 1 && !/^[a-z0-9]$/.test(name)) {
    errors.push(`Worker name "${name}" must be a lowercase letter or number`);
  }

  return errors;
}

/**
 * Validate an R2 bucket name.
 * Rules: 3-63 chars, lowercase letters/numbers/hyphens, no underscores.
 */
export function validateR2BucketName(name: string): string[] {
  const errors: string[] = [];

  if (name.length < 3) {
    errors.push(`R2 bucket name "${name}" must be at least 3 characters`);
  }
  if (name.length > 63) {
    errors.push(`R2 bucket name "${name}" exceeds 63 character limit`);
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && name.length > 2) {
    errors.push(
      `R2 bucket name "${name}" must be lowercase letters, numbers, and hyphens only`
    );
  }
  if (name.includes("_")) {
    errors.push(`R2 bucket name "${name}" cannot contain underscores`);
  }

  return errors;
}

/**
 * Validate a binding name (must be a valid JavaScript identifier).
 */
export function validateBindingName(name: string): string[] {
  const errors: string[] = [];

  if (!name) {
    errors.push("Binding name cannot be empty");
    return errors;
  }

  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
    errors.push(
      `Binding name "${name}" must be a valid JavaScript identifier. ` +
        `Workers access bindings as env.${name}`
    );
  }

  return errors;
}

/**
 * Validate an environment variable name.
 */
export function validateEnvVarName(name: string): string[] {
  const errors: string[] = [];

  if (!name) {
    errors.push("Environment variable name cannot be empty");
    return errors;
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    errors.push(`Environment variable name "${name}" contains invalid characters`);
  }

  return errors;
}

/**
 * Sanitize a string to prevent command injection.
 * Only allows alphanumeric, hyphens, underscores, dots, and forward slashes.
 */
export function sanitizeInput(input: string): string {
  return input.replace(/[^a-zA-Z0-9\-_./ ]/g, "");
}
