/**
 * `nova state`
 *
 * Manages Nova deployment state graph, resource mappings, locks, and history.
 */

import { Command } from "commander";
import chalk from "chalk";
import { StateManager } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function stateCommand(): Command {
  const cmd = new Command("state").description("Inspect and manage Nova deployment state");

  cmd
    .command("list")
    .description("List all active deployed resources in state")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Active Deployment State\n"));

      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const resources = stateMgr.getResources(app.name || "nova-app", options.env);

        if (resources.length === 0) {
          console.log(chalk.gray(`State is empty for app "${app.name}" (${options.env}). No resources deployed yet.`));
          return;
        }

        console.log(`Application: ${chalk.cyan(app.name)}`);
        console.log(`Environment: ${chalk.bold.magenta(options.env)}\n`);

        for (const res of resources) {
          console.log(`• ${chalk.cyan(res.id)} (${chalk.bold(res.type)}) - Status: ${chalk.green(res.status)}`);
        }
        console.log("");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`State list failed: ${msg}`));
      }
    });

  cmd
    .command("inspect <id>")
    .description("Inspect state details for a specific resource")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (id: string, options) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe State Inspect: ${id}\n`));

      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const resources = stateMgr.getResources(app.name || "nova-app", options.env);
        const res = resources.find((r: any) => r.id === id || r.name === id);

        if (!res) {
          console.log(chalk.red(`Resource "${id}" not found in active state.`));
          return;
        }

        console.log(JSON.stringify(res, null, 2));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`State inspect failed: ${msg}`));
      }
    });

  cmd
    .command("verify")
    .description("Verify state file integrity and lock status")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe State Integrity Check\n"));

      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const verification = stateMgr.verifyState(app.name || "nova-app", options.env);

        if (verification.valid) {
          console.log(chalk.bold.green("✓ State file integrity verified. Zero corruption or schema errors detected.\n"));
        } else {
          console.log(chalk.bold.red("✗ State Integrity Issues:"));
          for (const issue of verification.issues) {
            console.log(chalk.red(`  • ${issue}`));
          }
          console.log("");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`State verification failed: ${msg}`));
      }
    });

  cmd
    .command("export")
    .description("Export raw deployment state graph as JSON")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (options) => {
      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const history = stateMgr.getHistory(app.name || "nova-app", options.env);
        console.log(JSON.stringify(history, null, 2));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`State export failed: ${msg}`));
      }
    });

  cmd
    .command("reconcile")
    .description("Query live cloud infrastructure to reconcile UNKNOWN or uncertain resource states")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe State Reconciliation\n"));

      try {
        const app = await loadConfig();
        const stateMgr = new StateManager(process.cwd());
        const resources = stateMgr.getResources(app.name || "nova-app", options.env);

        if (resources.length === 0) {
          console.log(chalk.gray(`State is empty. Nothing to reconcile.`));
          return;
        }

        console.log(`Inspecting live cloud state for ${resources.length} resource(s)...`);
        const { AWSLiveStateInspector } = await import("novaserve-provider-aws");
        const inspector = new AWSLiveStateInspector(app.config.region || "us-east-1", app.name || "nova-app");
        const observed = await inspector.inspectResources(
          resources.map((r: any) => ({ id: r.id, type: r.type, name: r.name, config: r.config }))
        );

        const result = stateMgr.reconcileState(app.name || "nova-app", options.env, observed);

        if (result.reconciledCount === 0) {
          console.log(chalk.bold.green(`✓ All ${resources.length} resource states match live infrastructure.\n`));
        } else {
          console.log(chalk.bold.green(`✓ Reconciled ${result.reconciledCount} resource(s): ${result.updatedResources.join(", ")}\n`));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`State reconciliation failed: ${msg}`));
      }
    });

  return cmd;
}
