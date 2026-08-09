/**
 * nova destroy — Remove all deployed resources
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";
import { withSpinner } from "../ui/spinner.js";
import { DeploymentEngine } from "novaserve-core";

export function destroyCommand(): Command {
  return new Command("destroy")
    .description("Remove all deployed resources")
    .option("-e, --env <environment>", "Target environment", "production")
    .option("--force", "Skip confirmation prompt")
    .action(async (options) => {
      const app = await loadConfig();

      logger.warn(`This will destroy all resources for "${app.name}" in "${options.env}"`);
      logger.warn(`DATA LOSS WARNING: This action is irreversible. All S3 bucket contents and DynamoDB table data will be permanently deleted.`);
      logger.blank();

      if (!options.force) {
        logger.info("Use --force to skip this confirmation");
        // In production, we'd use inquirer to ask for confirmation
        // For MVP, require --force
        logger.error("Aborted. Use --force to confirm destruction.");
        process.exit(1);
      }

      try {
        const providerName = app.config.provider || "aws";
        let cloudProvider;

        if (providerName === "local") {
          const { LocalProvider } = await import("novaserve-provider-local");
          cloudProvider = new LocalProvider({});
        } else if (providerName === "aws") {
          const { AWSProvider } = await import("novaserve-provider-aws");
          cloudProvider = new AWSProvider();
        } else if (providerName === "azure") {
          const { AzureProvider } = await import("novaserve-provider-azure");
          cloudProvider = new AzureProvider();
        } else if (providerName === "gcp") {
          const { GCPProvider } = await import("novaserve-provider-gcp");
          cloudProvider = new GCPProvider();
        } else if (providerName === "cloudflare") {
          const { CloudflareProvider } = await import("novaserve-provider-cloudflare");
          cloudProvider = new CloudflareProvider();
        } else if (providerName === "docker") {
          const { DockerProvider } = await import("novaserve-provider-docker");
          cloudProvider = new DockerProvider();
        } else {
          logger.warn(`Provider "${providerName}" is unknown. Falling back to local for demo.`);
          const { LocalProvider } = await import("novaserve-provider-local");
          cloudProvider = new LocalProvider({});
        }

        const engine = new DeploymentEngine(cloudProvider, process.cwd());

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
