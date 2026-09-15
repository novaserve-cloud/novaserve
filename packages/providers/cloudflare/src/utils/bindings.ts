/**
 * Cloudflare Binding Resolution Engine
 *
 * Translates NovaServe binding definitions into Cloudflare Worker binding format.
 * Resolves provisioned resource IDs (KV namespace IDs, D1 database IDs, etc.)
 * into the exact binding structure the Cloudflare API expects.
 */

import type {
  CloudflareBindingDefinition,
  CloudflareResolvedBinding,
  CloudflareProvisionedResources,
  CloudflareKVConfig,
  CloudflareR2Config,
  CloudflareD1Config,
  CloudflareQueueConfig,
} from "../types.js";
import { CloudflareDeploymentError } from "../errors.js";

/**
 * Resolve all bindings for a Worker deployment.
 *
 * Takes the configured bindings and provisioned resources, and produces
 * the final binding array that the Cloudflare API requires.
 *
 * @param kvConfigs - KV namespace configurations
 * @param r2Configs - R2 bucket configurations
 * @param d1Configs - D1 database configurations
 * @param queueConfigs - Queue configurations
 * @param provisioned - Provisioned resource IDs from create/resolve operations
 * @param extraBindings - Additional explicit bindings from config
 * @param vars - Plain-text environment variables
 * @param environment - Current environment (for error context)
 */
export function resolveBindings(
  kvConfigs: CloudflareKVConfig[],
  r2Configs: CloudflareR2Config[],
  d1Configs: CloudflareD1Config[],
  queueConfigs: CloudflareQueueConfig[],
  provisioned: CloudflareProvisionedResources,
  extraBindings: CloudflareBindingDefinition[] = [],
  vars: Record<string, string> = {},
  environment?: string
): CloudflareResolvedBinding[] {
  const bindings: CloudflareResolvedBinding[] = [];

  // ── KV Namespace Bindings ───────────────────────────────────
  for (const kv of kvConfigs) {
    const namespaceId = provisioned.kv[kv.name];
    if (!namespaceId) {
      throw new CloudflareDeploymentError({
        message: `KV namespace "${kv.name}" was not provisioned. Cannot create binding.`,
        operation: "resolveBindings",
        resource: kv.name,
        environment,
      });
    }
    bindings.push({
      type: "kv_namespace",
      name: kv.name,
      namespace_id: namespaceId,
    });
  }

  // ── R2 Bucket Bindings ──────────────────────────────────────
  for (const r2 of r2Configs) {
    const bucketName = provisioned.r2[r2.name];
    if (!bucketName) {
      throw new CloudflareDeploymentError({
        message: `R2 bucket "${r2.name}" was not provisioned. Cannot create binding.`,
        operation: "resolveBindings",
        resource: r2.name,
        environment,
      });
    }
    bindings.push({
      type: "r2_bucket",
      name: r2.name,
      bucket_name: bucketName,
    });
  }

  // ── D1 Database Bindings ────────────────────────────────────
  for (const d1 of d1Configs) {
    const databaseId = provisioned.d1[d1.name];
    if (!databaseId) {
      throw new CloudflareDeploymentError({
        message: `D1 database "${d1.name}" was not provisioned. Cannot create binding.`,
        operation: "resolveBindings",
        resource: d1.name,
        environment,
      });
    }
    bindings.push({
      type: "d1",
      name: d1.name,
      id: databaseId,
    });
  }

  // ── Queue Bindings ──────────────────────────────────────────
  for (const queue of queueConfigs) {
    const queueName = provisioned.queues[queue.name];
    if (!queueName) {
      throw new CloudflareDeploymentError({
        message: `Queue "${queue.name}" was not provisioned. Cannot create binding.`,
        operation: "resolveBindings",
        resource: queue.name,
        environment,
      });
    }
    bindings.push({
      type: "queue",
      name: queue.name,
      queue_name: queueName,
    });
  }

  // ── Plain Text Environment Variables ────────────────────────
  for (const [name, value] of Object.entries(vars)) {
    bindings.push({
      type: "plain_text",
      name,
      text: value,
    });
  }

  // ── Extra Explicit Bindings ─────────────────────────────────
  for (const extra of extraBindings) {
    // Skip if already resolved above
    if (bindings.some((b) => b.name === extra.name)) {
      continue;
    }

    const resolved: CloudflareResolvedBinding = {
      type: extra.type,
      name: extra.name,
    };

    switch (extra.type) {
      case "kv_namespace":
        resolved.namespace_id = extra.resource || provisioned.kv[extra.name];
        break;
      case "r2_bucket":
        resolved.bucket_name = extra.resource || provisioned.r2[extra.name];
        break;
      case "d1":
        resolved.id = extra.resource || provisioned.d1[extra.name];
        break;
      case "queue":
        resolved.queue_name = extra.resource || provisioned.queues[extra.name];
        break;
      case "plain_text":
        resolved.text = extra.text || "";
        break;
      case "service":
        resolved.service = extra.resource;
        break;
      case "analytics_engine":
        resolved.dataset = extra.resource;
        break;
      default:
        // Pass through unknown binding types
        break;
    }

    bindings.push(resolved);
  }

  return bindings;
}

/**
 * Convert resolved bindings back to the format expected by the
 * Cloudflare Workers Script Upload API metadata.
 */
export function bindingsToApiFormat(
  bindings: CloudflareResolvedBinding[]
): Record<string, unknown>[] {
  return bindings.map((binding) => {
    const result: Record<string, unknown> = { type: binding.type, name: binding.name };

    switch (binding.type) {
      case "kv_namespace":
        result.namespace_id = binding.namespace_id;
        break;
      case "r2_bucket":
        result.bucket_name = binding.bucket_name;
        break;
      case "d1":
        result.id = binding.id;
        break;
      case "queue":
        result.queue_name = binding.queue_name;
        break;
      case "plain_text":
        result.text = binding.text;
        break;
      case "secret_text":
        result.text = binding.text;
        break;
      case "service":
        result.service = binding.service;
        break;
      case "analytics_engine":
        result.dataset = binding.dataset;
        break;
    }

    return result;
  });
}

/**
 * Validate binding names are valid JavaScript identifiers.
 */
export function validateBindingNames(
  bindings: Array<{ name: string; type: string }>
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const binding of bindings) {
    // Check valid JS identifier
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(binding.name)) {
      errors.push(
        `Binding name "${binding.name}" (${binding.type}) is not a valid JavaScript identifier. ` +
          `Workers access bindings as env.${binding.name}`
      );
    }

    // Check for duplicates
    if (seen.has(binding.name)) {
      errors.push(`Duplicate binding name "${binding.name}" — each binding must have a unique name`);
    }
    seen.add(binding.name);
  }

  return errors;
}
