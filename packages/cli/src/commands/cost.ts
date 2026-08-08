/**
 * `nova cost`
 *
 * Cost Intelligence Engine for monthly infrastructure expenditure estimation.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, NovaCostEstimator, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function costCommand(): Command {
  const cmd = new Command("cost").description("Infrastructure Cost Intelligence");

  cmd
    .command("estimate")
    .description("Estimate monthly infrastructure cost by resource and provider")
    .option("-p, --provider <name>", "Target cloud provider", "aws")
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Cost Intelligence & Estimation\n"));

      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          targetProvider: options.provider,
          resources: coreResources,
        });

        const report = NovaCostEstimator.estimate(compileResult.ir, options.provider);

        console.log(`Application: ${chalk.cyan(report.appName)}`);
        console.log(`Provider:    ${chalk.bold.magenta(report.provider.toUpperCase())}`);
        console.log(`Total Monthly Estimate: ${chalk.bold.green(`$${report.totalMonthlyUsd.toFixed(2)}`)}\n`);

        console.log(chalk.bold("Resource Breakdown:"));
        for (const item of report.items) {
          console.log(`• ${chalk.bold(item.resourceName)} (${item.type.toUpperCase()}): ${chalk.green(`$${item.estimatedMonthlyUsd.toFixed(2)}/mo`)}`);
          console.log(`  ${chalk.gray(item.breakdown)}`);
        }

        if (report.optimizations.length > 0) {
          console.log(`\n${chalk.bold.yellow("Potential Cost Optimizations:")}`);
          for (const opt of report.optimizations) {
            console.log(`💡 ${opt.advice}`);
          }
        }
        console.log("");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Cost estimation failed: ${msg}`));
      }
    });

  return cmd;
}
