/**
 * Cloudflare D1 Database Service — Full Lifecycle & Migrations
 *
 * Manages Cloudflare D1 databases with create, get, list, delete,
 * schema migrations, and migration tracking.
 *
 * Migration Safety:
 * - Never auto-runs destructive SQL (DROP, TRUNCATE, DELETE) in production
 * - Tracks applied migrations via a `_nova_migrations` table inside D1
 * - Migration failures include the failed file name and applied list
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CloudflareApiClient } from "../utils/api-client.js";
import type {
  CloudflareD1Database,
  CloudflareMigration,
  CloudflareMigrationStatus,
} from "../types.js";
import { CloudflareMigrationError } from "../errors.js";
import { isProductionEnvironment } from "../utils/environment.js";

/** Destructive SQL keywords that require explicit approval in production */
const DESTRUCTIVE_SQL_PATTERNS = [
  /\bDROP\s+(TABLE|INDEX|VIEW|TRIGGER)/i,
  /\bTRUNCATE\s+TABLE/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TABLE\s+\w+\s+DROP\b/i,
];

export class CloudflareD1Service {
  private client: CloudflareApiClient;

  constructor(client: CloudflareApiClient) {
    this.client = client;
  }

  /**
   * Create a D1 database.
   *
   * Idempotent: checks if a database with the same name already exists.
   * If it does, returns the existing database ID.
   *
   * @returns Database UUID
   */
  public async createDatabase(name: string): Promise<string> {
    // Check for existing database with this name
    const existing = await this.findDatabaseByName(name);
    if (existing) {
      return existing.uuid;
    }

    const result = await this.client.post<CloudflareD1Database>(
      "/d1/database",
      "createD1Database",
      { name },
      { resource: name }
    );

    return result?.uuid || "";
  }

  /**
   * Get a D1 database by ID.
   */
  public async getDatabase(
    databaseId: string
  ): Promise<CloudflareD1Database | null> {
    try {
      return await this.client.get<CloudflareD1Database>(
        `/d1/database/${databaseId}`,
        "getD1Database",
        { resource: databaseId }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return null;
      }
      throw err;
    }
  }

  /**
   * List all D1 databases in the account.
   */
  public async listDatabases(): Promise<CloudflareD1Database[]> {
    const result = await this.client.get<CloudflareD1Database[]>(
      "/d1/database",
      "listD1Databases"
    );
    return result || [];
  }

  /**
   * Delete a D1 database by ID.
   * Silently succeeds if the database doesn't exist.
   */
  public async deleteDatabase(databaseId: string): Promise<void> {
    try {
      await this.client.delete(
        `/d1/database/${databaseId}`,
        "deleteD1Database",
        { resource: databaseId }
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "CloudflareResourceNotFoundError"
      ) {
        return;
      }
      throw err;
    }
  }

  /**
   * Find an existing D1 database by name.
   * Used for idempotent creates.
   */
  public async findDatabaseByName(
    name: string
  ): Promise<CloudflareD1Database | null> {
    const databases = await this.listDatabases();
    return databases.find((db) => db.name === name) || null;
  }

  /**
   * Execute a single SQL statement against a D1 database.
   */
  public async executeSQL(
    databaseId: string,
    sql: string,
    params?: unknown[]
  ): Promise<unknown> {
    const body: Record<string, unknown> = { sql };
    if (params && params.length > 0) {
      body.params = params;
    }

    return this.client.post(
      `/d1/database/${databaseId}/query`,
      "executeD1SQL",
      body,
      { resource: databaseId }
    );
  }

  /**
   * Execute pending migrations for a D1 database.
   *
   * Reads migration files from the migrations directory,
   * determines which have already been applied, and executes
   * the pending ones in order.
   *
   * @param databaseId - D1 database UUID
   * @param migrationsDir - Path to the directory containing .sql migration files
   * @param environment - Target environment (safety checks for production)
   * @param allowDestructive - Allow destructive SQL in production (default: false)
   */
  public async executeMigrations(
    databaseId: string,
    migrationsDir: string,
    environment: string = "production",
    allowDestructive: boolean = false
  ): Promise<{
    applied: string[];
    skipped: string[];
    total: number;
  }> {
    // 1. Ensure migration tracking table exists
    await this.ensureMigrationTable(databaseId);

    // 2. Discover migration files
    const migrations = this.discoverMigrations(migrationsDir);
    if (migrations.length === 0) {
      return { applied: [], skipped: [], total: 0 };
    }

    // 3. Get already-applied migrations
    const status = await this.getMigrationStatus(databaseId);

    // 4. Filter pending migrations
    const appliedSet = new Set(status.applied);
    const pending = migrations.filter((m) => !appliedSet.has(m.filename));

    if (pending.length === 0) {
      return {
        applied: [],
        skipped: migrations.map((m) => m.filename),
        total: migrations.length,
      };
    }

    // 5. Safety check: block destructive SQL in production
    if (isProductionEnvironment(environment) && !allowDestructive) {
      for (const migration of pending) {
        const isDestructive = DESTRUCTIVE_SQL_PATTERNS.some((p) =>
          p.test(migration.sql)
        );
        if (isDestructive) {
          throw new CloudflareMigrationError({
            message:
              `Migration "${migration.filename}" contains destructive SQL ` +
              `(DROP/TRUNCATE/DELETE) and cannot be auto-applied in production. ` +
              `Use --allow-destructive to force execution.`,
            operation: "executeMigrations",
            resource: databaseId,
            environment,
            migrationFile: migration.filename,
            appliedMigrations: status.applied,
          });
        }
      }
    }

    // 6. Execute pending migrations in order
    const applied: string[] = [];

    for (const migration of pending) {
      try {
        await this.executeMigration(databaseId, migration.sql);
        await this.recordMigration(databaseId, migration.filename);
        applied.push(migration.filename);
      } catch (err) {
        throw new CloudflareMigrationError({
          message: `Migration "${migration.filename}" failed: ${err instanceof Error ? err.message : String(err)}`,
          operation: "executeMigrations",
          resource: databaseId,
          environment,
          migrationFile: migration.filename,
          appliedMigrations: [...status.applied, ...applied],
          cause: err instanceof Error ? err : undefined,
        });
      }
    }

    return {
      applied,
      skipped: migrations
        .filter((m) => appliedSet.has(m.filename))
        .map((m) => m.filename),
      total: migrations.length,
    };
  }

  /**
   * Execute a single migration SQL.
   */
  public async executeMigration(
    databaseId: string,
    sql: string
  ): Promise<void> {
    await this.executeSQL(databaseId, sql);
  }

  /**
   * Get the current migration status for a D1 database.
   */
  public async getMigrationStatus(
    databaseId: string
  ): Promise<CloudflareMigrationStatus> {
    try {
      const result = (await this.executeSQL(
        databaseId,
        "SELECT filename FROM _nova_migrations ORDER BY applied_at ASC"
      )) as Array<{ results?: Array<{ filename: string }> }>;

      const applied =
        result?.[0]?.results?.map(
          (r: { filename: string }) => r.filename
        ) || [];

      return {
        applied,
        pending: [],
        total: applied.length,
      };
    } catch {
      // Table may not exist yet
      return { applied: [], pending: [], total: 0 };
    }
  }

  // ── Private Helpers ─────────────────────────────────────────

  /**
   * Ensure the migration tracking table exists.
   */
  private async ensureMigrationTable(databaseId: string): Promise<void> {
    await this.executeSQL(
      databaseId,
      `CREATE TABLE IF NOT EXISTS _nova_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );
  }

  /**
   * Record a migration as applied.
   */
  private async recordMigration(
    databaseId: string,
    filename: string
  ): Promise<void> {
    await this.executeSQL(
      databaseId,
      "INSERT INTO _nova_migrations (filename) VALUES (?)",
      [filename]
    );
  }

  /**
   * Discover migration files from a directory.
   *
   * Expected format: `NNNN_description.sql` (e.g. `0001_create_users.sql`)
   * Files are sorted by filename (which gives order by numeric prefix).
   */
  private discoverMigrations(migrationsDir: string): CloudflareMigration[] {
    if (!existsSync(migrationsDir)) {
      return [];
    }

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    return files.map((filename, index) => ({
      filename,
      sql: readFileSync(join(migrationsDir, filename), "utf-8"),
      index,
    }));
  }
}
