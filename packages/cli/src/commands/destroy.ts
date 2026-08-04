/**
 * nova destroy — Remove all deployed resources
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";
import { withSpinner } from "../ui/spinner.js";
import { DeploymentEngine } from "@novaserve/core";

export function destroyCommand(): Command {
  return new Command("destroy")
    .description("Remove all deployed resources")
    .option("-e, --env <environment>", "Target environment", "production")
    .option("--force", "Skip confirmation prompt")
    .action(async (options) => {
      const app = await loadConfig();

      logger.warn(`This will destroy all resources for "${app.name}" in "${options.env}"`);
      logger.blank();

      if (!options.force) {
        logger.info("Use --force to skip this confirmation");
        // In production, we'd use inquirer to ask for confirmation
        // For MVP, require --force
        logger.error("Aborted. Use --force to confirm destruction.");
        process.exit(1);
      }

      try {
        const { LocalProvider } = await import("@novaserve/provider-local");
        const provider = new LocalProvider({});
        const engine = new DeploymentEngine(provider, process.cwd());

        await withSpinner("Destroying resources...", () =>
          engine.destroy(app, options.env)
        );

        logger.blank();
        logger.success(`All resources for "${app.name}" destroyed.`);
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }

      logger.blank();
    });
}
