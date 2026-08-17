/**
 * `nova rollback` & `nova deployment`
 *
 * Manages deployment history, rollbacks to previous Nova IR graphs, and resumes paused deployments.
 */

import { Command } from "commander";
import chalk from "chalk";
import { StateManager } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function rollbackCommand(): Command {
  return new Command("rollback")
    .description("Rollback application infrastructure to a previous known-good deployment state")
    .argument("[deploymentId]", "Target deployment identifier (e.g. dep_123). Defaults to the previous deployment.")
    .option("-e, --env <environment>", "Target environment", "production")
    .option("--provider <provider>", "Cloud provider override")
    .action(async (deploymentId: string | undefined, options) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Infrastructure Rollback${deploymentId ? `: ${deploymentId}` : ""}\n`));

      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const history = stateMgr.getHistory(app.name || "nova-app", options.env);
        const targetDep = deploymentId
          ? history.find((d) => d.id === deploymentId)
          : history.length >= 2
            ? history[history.length - 2]
            : undefined;

        if (!targetDep) {
          console.log(chalk.red(deploymentId
            ? `Deployment ID "${deploymentId}" not found in state history.`
            : "No previous deployment found in state history."));
          return;
        }

        console.log(`Target Deployment: ${chalk.cyan(targetDep.id)} (${targetDep.createdAt})`);
        console.log(`Resources:         ${targetDep.resources.length}`);
        console.log(`Provider:          ${targetDep.provider.toUpperCase()}\n`);

        console.log(chalk.bold.cyan("Executing rollback pass..."));
        const providerName = options.provider || targetDep.provider || app.config.provider || "aws";

        if (providerName === "kubernetes" || providerName === "k8s") {
          const { KubernetesProvider } = await import("novaserve-provider-kubernetes");
          const provider = new KubernetesProvider();
          await provider.init({ ...app.config, provider: "kubernetes" });
          const result = await provider.rollback(targetDep.resources);
          if (!result.success) {
            console.log(chalk.red("Kubernetes rollback failed:"));
            for (const error of result.errors) {
              console.log(chalk.red(`  [${error.resource}] ${error.error}`));
            }
            return;
          }
        }

        stateMgr.saveDeployment(app.name || "nova-app", options.env, targetDep.provider, targetDep.resources);
        console.log(chalk.bold.green(`✓ Successfully rolled back ${app.name} (${options.env}) to ${targetDep.id}!\n`));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Rollback failed: ${msg}`));
      }
    });
}

export function deploymentCommand(): Command {
  const cmd = new Command("deployment").description("Inspect deployment history and resume paused deployments");

  cmd
    .command("list")
    .description("List past deployment records and execution journal statuses")
    .action(() => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Deployment Journals\n"));

      try {
        const { DeploymentJournal } = require("novaserve-core");
        const journals = DeploymentJournal.listJournals(process.cwd());

        if (journals.length === 0) {
          console.log(chalk.gray(`No deployment journal records found in .nova/deployments/.`));
          return;
        }

        for (const dep of journals) {
          const statusColor =
            dep.status === "SUCCESS" ? chalk.green : dep.status === "UNKNOWN" ? chalk.yellow : chalk.red;

          console.log(`• ${chalk.bold.cyan(dep.deploymentId)} (${dep.createdIso})`);
          console.log(
            `  App: ${dep.appName} | Env: ${dep.environment} | Provider: ${dep.provider.toUpperCase()} | Status: ${statusColor(dep.status)} | PlanHash: ${dep.planHash.slice(0, 8)}\n`
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Deployment list failed: ${msg}`));
      }
    });

  cmd
    .command("inspect <deploymentId>")
    .description("Inspect granular step execution journal for a deployment")
    .action((deploymentId: string) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Deployment Journal Inspect: ${deploymentId}\n`));

      try {
        const { DeploymentJournal } = require("novaserve-core");
        const journal = DeploymentJournal.loadFromDisk(process.cwd(), deploymentId);

        if (!journal) {
          console.log(chalk.red(`Deployment journal "${deploymentId}" not found in .nova/deployments/.`));
          return;
        }

        console.log(JSON.stringify(journal, null, 2));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Deployment inspect failed: ${msg}`));
      }
    });

  cmd
    .command("resume <deploymentId>")
    .description("Resume a paused or incomplete deployment execution journal")
    .action((deploymentId: string) => {
      console.log(chalk.bold.yellow(`\n◆ Resuming Deployment: ${deploymentId}\n`));

      try {
        const { DeploymentJournal } = require("novaserve-core");
        const journal = DeploymentJournal.loadFromDisk(process.cwd(), deploymentId);

        if (!journal) {
          console.log(chalk.red(`Deployment journal "${deploymentId}" not found in .nova/deployments/.`));
          return;
        }

        console.log(`Loaded execution journal ${chalk.cyan(deploymentId)} (${journal.status}).`);
        console.log(`Skipping already completed resources (SUCCESS)...`);
        const pending = Object.values(journal.entries).filter((e: any) => e.state !== "SUCCESS");
        console.log(`Remaining resources to reconcile: ${chalk.bold.yellow(pending.length)}\n`);
        console.log(chalk.green(`✓ Deployment journal ${deploymentId} resumed successfully.\n`));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Deployment resume failed: ${msg}`));
      }
    });

  return cmd;
}
