/**
 * Config Loader
 *
 * Loads nova.config.ts from the current project.
 */

import { ConfigParser } from "novaserve-core";
import type { NovaApp } from "novaserve-sdk";
import { logger } from "./logger.js";

/**
 * Load the nova config from the current directory.
 * Exits the process with an error message if not found.
 */
export async function loadConfig(cwd?: string): Promise<NovaApp> {
  const parser = new ConfigParser(cwd || process.cwd());

  const configFile = parser.findConfigFile();
  if (!configFile) {
    logger.error("No nova.config.ts found in this directory.");
    logger.blank();
    logger.info("Run 'nova init' to create a new project.");
    process.exit(1);
  }

  try {
    return await parser.load();
  } catch (error) {
    logger.error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
