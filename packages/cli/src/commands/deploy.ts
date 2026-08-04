/**
 * nova deploy — Deploy to the cloud
 *
 * Full deployment pipeline: validate → build → plan → deploy.
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";
import { withSpinner } from "../ui/spinner.js";
import { DeploymentEngine, InfrastructureDiff, toResource } from "@novaserve/core";

export function deployCommand(): Command {
  return new Command("deploy")
    .description("Deploy application to the cloud")
    .option("-e, --env <environment>", "Target environment", "production")
    .option("--provider <provider>", "Cloud provider override")
    .option("--dry-run", "Show deployment plan without deploying")
    .option("--force", "Skip confirmation prompt")
    .action(async (options) => {
      const app = await loadConfig();
      const environment = options.env;
      const provider = options.provider || app.config.provider || "aws";

      logger.box([
        { key: "App:", value: app.name },
        { key: "Environment:", value: environment },
        { key: "Provider:", value: provider.toUpperCase() },
        { key: "Region:", value: app.config.region || "us-east-1" },
        { key: "Runtime:", value: app.config.runtime || "node20" },
      ]);

      // Load the appropriate provider
      let cloudProvider;
      try {
        if (provider === "local") {
          const { LocalProvider } = await import("@novaserve/provider-local");
          cloudProvider = new LocalProvider({});
        } else {
          // For now, use local provider as fallback
          logger.warn(`Provider "${provider}" not yet implemented. Using local provider for demo.`);
          const { LocalProvider } = await import("@novaserve/provider-local");
          cloudProvider = new LocalProvider({});
        }
      } catch (error) {
        logger.error(`Failed to load provider "${provider}": ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }

      const engine = new DeploymentEngine(cloudProvider, process.cwd());

      try {
        const result = await withSpinner(
          `Deploying ${app.resources.length} resource(s)...`,
          () => engine.deploy(app, {
            environment,
            dryRun: options.dryRun,
            force: options.force,
          })
        );

        logger.blank();

        if (result.success) {
          logger.success("Deployed successfully!");
          logger.blank();

          if (Object.keys(result.outputs).length > 0) {
            logger.info("Outputs:");
            for (const [key, value] of Object.entries(result.outputs)) {
              logger.kv(key, value);
            }
          }

          logger.blank();
          logger.kv("Duration:", `${(result.durationMs / 1000).toFixed(1)}s`);
        } else {
          logger.error("Deployment failed:");
          for (const err of result.errors) {
            logger.error(`  [${err.resource}] ${err.error}`);
          }
          process.exit(1);
        }
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }

      logger.blank();
    });
}
