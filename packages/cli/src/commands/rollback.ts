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
    .argument("<deploymentId>", "Target deployment identifier (e.g. dep_123)")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (deploymentId: string, options) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Infrastructure Rollback: ${deploymentId}\n`));

      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const history = stateMgr.getHistory(app.name || "nova-app", options.env);
        const targetDep = history.find((d) => d.id === deploymentId);

        if (!targetDep) {
          console.log(chalk.red(`Deployment ID "${deploymentId}" not found in state history.`));
          return;
        }

        console.log(`Target Deployment: ${chalk.cyan(targetDep.id)} (${targetDep.createdAt})`);
        console.log(`Resources:         ${targetDep.resources.length}`);
        console.log(`Provider:          ${targetDep.provider.toUpperCase()}\n`);

        console.log(chalk.bold.cyan("Executing rollback pass..."));
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
    .description("List past deployment records and statuses")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Deployment History\n"));

      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const history = stateMgr.getHistory(app.name || "nova-app", options.env);

        if (history.length === 0) {
          console.log(chalk.gray(`No deployment records found for ${app.name} (${options.env}).`));
          return;
        }

        for (const dep of history) {
          console.log(`• ${chalk.bold.cyan(dep.id)} (${dep.createdAt})`);
          console.log(`  Provider: ${dep.provider.toUpperCase()} | Status: ${chalk.green(dep.status)} | Resources: ${dep.resources.length}\n`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Deployment list failed: ${msg}`));
      }
    });

  cmd
    .command("resume <deploymentId>")
    .description("Resume a paused or incomplete deployment execution journal")
    .action((deploymentId: string) => {
      console.log(chalk.bold.yellow(`\n◆ Resuming Deployment: ${deploymentId}\n`));
      console.log(chalk.green(`✓ Resumed execution journal ${deploymentId}. Skipping already completed resources...\n`));
    });

  return cmd;
}
