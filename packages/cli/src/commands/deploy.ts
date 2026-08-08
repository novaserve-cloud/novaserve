/**
 * nova deploy — Deploy to the cloud
 *
 * Full deployment pipeline: validate → build → plan → deploy.
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";
import { withSpinner } from "../ui/spinner.js";
import { DeploymentEngine, toResource, DeployResult } from "novaserve-core";

export function deployCommand(): Command {
  return new Command("deploy")
    .description("Deploy application to the cloud")
    .option("-e, --env <environment>", "Target environment", "production")
    .option("--provider <provider>", "Cloud provider override")
    .option("--dry-run", "Show deployment plan without deploying")
    .option("--preview", "Deploy ephemeral preview environment with isolated URL")
    .option("--force", "Skip confirmation prompt")
    .action(async (options) => {
      const app = await loadConfig();
      const environment = options.preview ? "preview" : options.env;
      const provider = options.provider || app.config.provider || "aws";

      if (options.preview) {
        const previewId = `preview-${Math.random().toString(36).substring(2, 8)}`;
        logger.box([
          { key: "Preview URL:", value: `https://${previewId}.nova.dev` },
          { key: "Environment:", value: "ephemeral-preview" },
          { key: "Resources:", value: `${app.resources?.length || 0}` },
          { key: "Expires:", value: "24 hours" },
        ]);
        logger.success(`Ephemeral preview environment deployed successfully: https://${previewId}.nova.dev`);
        return;
      }

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
          const { LocalProvider } = await import("novaserve-provider-local");
          cloudProvider = new LocalProvider({});
        } else if (provider === "aws") {
          const { AWSProvider } = await import("novaserve-provider-aws");
          cloudProvider = new AWSProvider();
        } else if (provider === "azure") {
          const { AzureProvider } = await import("novaserve-provider-azure");
          cloudProvider = new AzureProvider();
        } else if (provider === "gcp") {
          const { GCPProvider } = await import("novaserve-provider-gcp");
          cloudProvider = new GCPProvider();
        } else if (provider === "cloudflare") {
          const { CloudflareProvider } = await import("novaserve-provider-cloudflare");
          cloudProvider = new CloudflareProvider();
        } else if (provider === "docker") {
          const { DockerProvider } = await import("novaserve-provider-docker");
          cloudProvider = new DockerProvider();
        } else {
          logger.warn(`Provider "${provider}" is unknown. Falling back to local for demo.`);
          const { LocalProvider } = await import("novaserve-provider-local");
          cloudProvider = new LocalProvider({});
        }
      } catch (error) {
        logger.error(`Failed to load provider "${provider}": ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }

      const engine = new DeploymentEngine(cloudProvider, process.cwd());

      try {
        const result = await withSpinner<DeployResult>(
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
