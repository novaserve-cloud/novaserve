/**
 * Database Resource Builder
 *
 * Define managed databases with automatic provisioning.
 * Supports Postgres, MySQL, MongoDB, DynamoDB.
 */

import type { ResourceDefinition } from "../app.js";

/** Supported database engines */
export type DatabaseEngine = "postgres" | "mysql" | "mongodb" | "dynamodb";

/** Database scaling configuration */
export interface DatabaseScaling {
  /** Minimum capacity units / instances */
  min: number;
  /** Maximum capacity units / instances */
  max: number;
}

/** Database configuration */
export interface DatabaseConfig {
  /** Database instance name */
  name?: string;
  /** Database engine version */
  version?: string;
  /** Auto-scaling configuration */
  scaling?: DatabaseScaling;
  /** Instance size (for provisioned) */
  size?: "small" | "medium" | "large" | "xlarge";
  /** Enable auto-pause for serverless (default: true) */
  autoPause?: boolean;
  /** Backup retention in days */
  backupRetentionDays?: number;
  /** Enable deletion protection */
  deletionProtection?: boolean;
  /** VPC placement */
  vpc?: boolean;
}

/** Resolved database resource */
export interface DatabaseResource extends ResourceDefinition {
  readonly _type: "database";
  readonly _config: DatabaseConfig & { engine: DatabaseEngine } & Record<string, unknown>;
}

/**
 * Database resource builder.
 *
 * @example
 * ```ts
 * // Serverless Postgres
 * database.postgres({ scaling: { min: 0, max: 2 } })
 *
 * // MySQL with fixed size
 * database.mysql({ size: "small" })
 *
 * // DynamoDB
 * database.dynamodb()
 *
 * // MongoDB
 * database.mongodb()
 * ```
 */
export const database = {
  postgres(config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("postgres", config);
  },

  mysql(config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("mysql", config);
  },

  mongodb(config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("mongodb", config);
  },

  dynamodb(config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("dynamodb", config);
  },
};

function createDatabase(engine: DatabaseEngine, config: DatabaseConfig): DatabaseResource {
  return {
    _type: "database",
    _name: config.name || engine,
    _config: {
      engine,
      autoPause: true,
      backupRetentionDays: 7,
      deletionProtection: false,
      ...config,
    } as DatabaseConfig & { engine: DatabaseEngine } & Record<string, unknown>,
  };
}
