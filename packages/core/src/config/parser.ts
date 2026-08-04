/**
 * Config Parser
 *
 * Loads and evaluates nova.config.ts using dynamic import.
 * Supports TypeScript files via esbuild transpilation.
 */

import { build } from "esbuild";
import { existsSync } from "node:fs";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import type { NovaApp } from "@novaserve/sdk";
import { CONFIG_FILE_NAMES } from "./schema.js";

export class ConfigParser {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Find and load the nova config file.
   * Transpiles TypeScript to JS, then dynamically imports it.
   */
  async load(): Promise<NovaApp> {
    const configPath = this.findConfigFile();
    if (!configPath) {
      throw new Error(
        `[NovaServe] No config file found. Create one of: ${CONFIG_FILE_NAMES.join(", ")}`
      );
    }

    // Transpile TypeScript config to temporary JS
    const tempDir = join(this.projectRoot, ".nova", "tmp");
    await mkdir(tempDir, { recursive: true });

    const configHash = createHash("md5")
      .update(await readFile(configPath, "utf-8"))
      .digest("hex")
      .slice(0, 8);

    const tempFile = join(tempDir, `config-${configHash}.mjs`);

    try {
      // Use esbuild to transpile the config
      await build({
        entryPoints: [configPath],
        outfile: tempFile,
        bundle: true,
        format: "esm",
        platform: "node",
        target: "node20",
        external: ["@novaserve/*", "novaserve"],
        write: true,
        logLevel: "silent",
      });

      // Dynamically import the transpiled config
      const fileUrl = pathToFileURL(tempFile).href;
      const module = await import(fileUrl);
      const config: NovaApp = module.default?.default || module.default;

      if (!config || !config.config) {
        throw new Error(
          "[NovaServe] Config file must export a default defineApp() call.\n" +
            "Example:\n" +
            '  import { defineApp } from "novaserve";\n' +
            "  export default defineApp({ name: \"my-app\" });"
        );
      }

      return config;
    } finally {
      // Cleanup temp file
      try {
        await unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Find the config file in the project root.
   */
  findConfigFile(): string | null {
    for (const name of CONFIG_FILE_NAMES) {
      const fullPath = join(this.projectRoot, name);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  /**
   * Get the project root directory.
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }
}
