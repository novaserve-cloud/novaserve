/**
 * Storage Resource Builder
 *
 * Define object storage buckets (S3, R2, GCS, etc.)
 * with a simple TypeScript API.
 */

import type { ResourceDefinition } from "../app.js";

/** Storage bucket configuration */
export interface StorageConfig {
  /** Allow public access (default: false) */
  public?: boolean;
  /** Max file size (e.g., "10mb", "1gb") */
  maxSize?: string;
  /** Enable versioning */
  versioning?: boolean;
  /** Lifecycle rules */
  lifecycle?: {
    /** Move to archive after N days */
    archiveAfterDays?: number;
    /** Delete after N days */
    deleteAfterDays?: number;
  };
  /** Enable CDN for public buckets */
  cdn?: boolean;
  /** CORS configuration for direct uploads */
  cors?: boolean;
  /** Allowed file types (MIME types) */
  allowedTypes?: string[];
  /** Enable server-side encryption */
  encryption?: boolean;
  /** Trigger function on upload */
  onUpload?: string;
  /** Trigger function on delete */
  onDelete?: string;
}

/** Resolved storage resource */
export interface StorageBucketResource extends ResourceDefinition {
  readonly _type: "storage";
  readonly _config: StorageConfig & Record<string, unknown>;
}

/**
 * Storage resource builder.
 *
 * @example
 * ```ts
 * // Simple bucket
 * storage.bucket("uploads")
 *
 * // Configured bucket
 * storage.bucket("media", {
 *   public: true,
 *   maxSize: "50mb",
 *   cdn: true,
 *   onUpload: "src/handlers/media.onUpload",
 * })
 * ```
 */
export const storage = {
  bucket(name: string, config: StorageConfig = {}): StorageBucketResource {
    if (!name) {
      throw new Error("[NovaServe] Storage bucket name is required");
    }

    return {
      _type: "storage",
      _name: name,
      _config: {
        public: false,
        versioning: false,
        encryption: true,
        ...config,
      } as StorageConfig & Record<string, unknown>,
    };
  },
};
