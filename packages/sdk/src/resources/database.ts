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

export const database = {
  postgres(nameOrConfig?: string | DatabaseConfig, config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("postgres", nameOrConfig, config);
  },

  mysql(nameOrConfig?: string | DatabaseConfig, config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("mysql", nameOrConfig, config);
  },

  mongodb(nameOrConfig?: string | DatabaseConfig, config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("mongodb", nameOrConfig, config);
  },

  dynamodb(nameOrConfig?: string | DatabaseConfig, config: DatabaseConfig = {}): DatabaseResource {
    return createDatabase("dynamodb", nameOrConfig, config);
  },
};

function createDatabase(
  engine: DatabaseEngine,
  nameOrConfig?: string | DatabaseConfig,
  overrideConfig: DatabaseConfig = {}
): DatabaseResource {
  const isNameString = typeof nameOrConfig === "string";
  const name = isNameString ? nameOrConfig : nameOrConfig?.name || engine;
  const baseConfig = isNameString ? overrideConfig : nameOrConfig || {};

  return {
    _type: "database",
    _name: name,
    _config: {
      engine,
      name,
      autoPause: true,
      backupRetentionDays: 7,
      deletionProtection: false,
      ...baseConfig,
    } as DatabaseConfig & { engine: DatabaseEngine } & Record<string, unknown>,
  };
}
