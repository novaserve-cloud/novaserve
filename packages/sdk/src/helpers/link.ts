/**
 * Resource Linking
 *
 * Connect resources together with type-safe references.
 * NovaServe auto-generates IAM permissions and environment variables.
 */

import type { ResourceDefinition } from "../app.js";

/**
 * Link resources together.
 *
 * When you link resource A to resource B, NovaServe:
 * 1. Grants B permission to access A
 * 2. Injects A's connection details as env vars into B
 * 3. Adds A as a dependency of B in the deployment graph
 *
 * @example
 * ```ts
 * const uploads = storage.bucket("uploads");
 * const processImage = fn.create("process-image", {
 *   handler: "src/workers/image.process",
 * });
 *
 * // Link storage to function — auto-grants S3 access + injects UPLOADS_BUCKET_NAME
 * link(uploads, processImage);
 * ```
 */
export function link(source: ResourceDefinition, target: ResourceDefinition): ResourceDefinition {
  // Create a new resource definition with the dependency added
  const dependencies = [...(target._dependencies || []), source];

  return {
    ...target,
    _dependencies: dependencies,
  };
}

/**
 * Link multiple resources to a target.
 *
 * @example
 * ```ts
 * linkAll([uploads, db, cache], processFunction);
 * ```
 */
export function linkAll(
  sources: ResourceDefinition[],
  target: ResourceDefinition
): ResourceDefinition {
  let result = target;
  for (const source of sources) {
    result = link(source, result);
  }
  return result;
}
