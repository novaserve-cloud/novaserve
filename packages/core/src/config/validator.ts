/**
 * Config Validator
 *
 * Validates the parsed NovaApp configuration for correctness.
 */

import type { NovaApp } from "@novaserve/sdk";
import { VALIDATION_RULES } from "./schema.js";

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  /**
   * Validate a loaded NovaApp configuration.
   */
  validate(app: NovaApp): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const config = app.config;

    // Validate app name
    if (!config.name) {
      errors.push("Application name is required");
    } else {
      if (config.name.length < VALIDATION_RULES.name.minLength) {
        errors.push("Application name cannot be empty");
      }
      if (config.name.length > VALIDATION_RULES.name.maxLength) {
        errors.push(`Application name must be ${VALIDATION_RULES.name.maxLength} characters or less`);
      }
      if (!VALIDATION_RULES.name.pattern.test(config.name)) {
        errors.push(VALIDATION_RULES.name.message);
      }
    }

    // Validate memory
    if (config.memory !== undefined) {
      if (config.memory < VALIDATION_RULES.memory.min || config.memory > VALIDATION_RULES.memory.max) {
        errors.push(VALIDATION_RULES.memory.message);
      }
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (config.timeout < VALIDATION_RULES.timeout.min || config.timeout > VALIDATION_RULES.timeout.max) {
        errors.push(VALIDATION_RULES.timeout.message);
      }
    }

    // Validate resources
    if (config.resources) {
      const resourceNames = new Set<string>();
      for (const [key, resource] of Object.entries(config.resources)) {
        if (!resource._type) {
          errors.push(`Resource "${key}" has no type. Use resource builders like api.create(), storage.bucket(), etc.`);
        }

        const resourceId = `${resource._type}-${resource._name}`;
        if (resourceNames.has(resourceId)) {
          errors.push(`Duplicate resource: ${resourceId}`);
        }
        resourceNames.add(resourceId);
      }
    }

    // Validate environments
    if (config.environments) {
      for (const [envName, envConfig] of Object.entries(config.environments)) {
        if (!/^[a-z][a-z0-9-]*$/.test(envName)) {
          errors.push(`Invalid environment name "${envName}". Use lowercase letters, numbers, and hyphens.`);
        }

        if (envConfig.variables) {
          for (const [varName] of Object.entries(envConfig.variables)) {
            if (!/^[A-Z][A-Z0-9_]*$/.test(varName)) {
              warnings.push(
                `Environment variable "${varName}" in "${envName}" should be UPPERCASE_WITH_UNDERSCORES`
              );
            }
          }
        }
      }
    }

    // Warnings for best practices
    if (!config.region) {
      warnings.push("No region specified. Defaulting to us-east-1");
    }

    if (!config.resources || Object.keys(config.resources).length === 0) {
      warnings.push("No resources defined. Add resources to deploy infrastructure.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
