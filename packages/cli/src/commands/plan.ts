/**
 * `nova plan`
 *
 * Generates and displays the infrastructure deployment plan from Nova IR.
 * Supports saving plan files for deterministic CI/CD deployment execution.
 */

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "fs";
import { NovaCompiler, NovaPlanner, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function planCommand(): Command {
  return new Command("plan")
    .description("Generate and preview infrastructure changes from Nova IR")
    .option("-p, --provider <name>", "Target cloud provider (aws, docker, cloudflare)", "aws")
    .option("--save <filepath>", "Save generated execution plan JSON to a file")
    .option("--json", "Output execution plan as raw machine-readable JSON", false)
    .option("--ci", "Run in non-interactive CI mode", false)
    .action(async (options) => {
      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          targetProvider: options.provider,
          resources: coreResources,
        });

        const plan = NovaPlanner.plan(compileResult.ir, {}, options.provider);

        if (options.save) {
          writeFileSync(options.save, JSON.stringify(plan, null, 2));
          console.log(chalk.bold.green(`✓ Saved execution plan to ${options.save}`));
        }

        if (options.json) {
          console.log(JSON.stringify({ plan, validation: compileResult.capabilityValidation }, null, 2));
          return;
        }

        if (!options.ci) {
          console.log(chalk.bold.yellow("\n◆ NovaServe Plan\n"));
        }

        console.log(`Application: ${chalk.cyan(plan.appName)}`);
        console.log(`Provider:    ${chalk.bold.magenta(plan.provider.toUpperCase())}`);
        console.log(`IR Hash:     ${chalk.gray(plan.irHash.slice(0, 8))}\n`);

        if (compileResult.capabilityValidation.errors.length > 0) {
          console.log(chalk.bold.red("Capability Errors Detected:"));
          for (const err of compileResult.capabilityValidation.errors) {
            console.log(chalk.red(`  ✗ ${err.message}`));
          }
          console.log("");
          if (options.ci) process.exit(3);
        }

        console.log(chalk.bold("Resources:"));
        for (const action of plan.actions) {
          if (action.action === "create") {
            console.log(chalk.green(`  + ${action.resourceType.toUpperCase()} ${action.name}`));
          } else if (action.action === "update") {
            console.log(chalk.yellow(`  ~ ${action.resourceType.toUpperCase()} ${action.name}`));
          } else if (action.action === "replace") {
            console.log(chalk.cyan(`  != ${action.resourceType.toUpperCase()} ${action.name} (replace: ${action.reason})`));
          } else if (action.action === "delete") {
            console.log(chalk.red(`  - ${action.resourceType.toUpperCase()} ${action.name}`));
          } else {
            console.log(chalk.gray(`  • ${action.resourceType.toUpperCase()} ${action.name} (no changes)`));
          }
        }

        console.log(`\nEstimated deployment time: ${chalk.bold.cyan(`${plan.totalEstimatedSeconds}s`)}`);
        console.log(`Estimated monthly cost:    ${chalk.bold.green(`$${plan.totalEstimatedMonthlyCostUsd.toFixed(2)}`)}\n`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Plan failed: ${msg}`));
        if (options.ci) process.exit(1);
      }
    });
}
