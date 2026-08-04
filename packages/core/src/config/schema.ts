/**
 * Config Schema
 *
 * Validation schemas for nova.config.ts
 */

/** Valid config file names (searched in order) */
export const CONFIG_FILE_NAMES = [
  "nova.config.ts",
  "nova.config.js",
  "nova.config.mts",
  "nova.config.mjs",
] as const;

/** Default app configuration */
export const DEFAULT_CONFIG = {
  region: "us-east-1",
  runtime: "node20",
  memory: 256,
  timeout: 30,
  provider: "aws",
} as const;

/** Validation rules */
export const VALIDATION_RULES = {
  name: {
    minLength: 1,
    maxLength: 64,
    pattern: /^[a-z][a-z0-9-]*$/,
    message: "App name must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens",
  },
  memory: {
    min: 128,
    max: 10240,
    message: "Memory must be between 128 MB and 10240 MB",
  },
  timeout: {
    min: 1,
    max: 900,
    message: "Timeout must be between 1 and 900 seconds",
  },
} as const;
