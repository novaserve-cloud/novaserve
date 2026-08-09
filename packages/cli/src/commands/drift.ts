/**
 * `nova drift`
 *
 * Detects infrastructure configuration drift between live state and Nova IR.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, NovaDriftEngine, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function driftCommand(): Command {
  return new Command("drift")
    .description("Detect live infrastructure drift against expected Nova IR")
    .option("--fix", "Reconcile drift back to expected Nova IR configuration", false)
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Infrastructure Drift Detection\n"));

      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });

        const { AWSLiveStateInspector } = await import("novaserve-provider-aws");
        const inspector = new AWSLiveStateInspector(app.config.region || "us-east-1", app.name || "nova-app");
        const observed = await inspector.inspectResources(
          coreResources.map((r: any) => ({
            id: `${r.type}-${r.name}`,
            type: r.type,
            name: r.name,
            config: r.config,
          }))
        );

        const liveStateMap: Record<string, { config: Record<string, unknown> }> = {};
        for (const [id, obs] of Object.entries(observed)) {
          liveStateMap[id] = { config: (obs as any).liveConfig };
        }

        const report = NovaDriftEngine.detect(compileResult.ir, liveStateMap);

        if (!report.hasDrift) {
          console.log(chalk.bold.green("✓ Zero infrastructure drift detected. Live state matches Nova IR perfectly.\n"));
          return;
        }

        console.log(`Application: ${chalk.cyan(report.appName)} (${report.environment})`);
        console.log(`Total Drifts Detected: ${chalk.bold.yellow(report.totalDrifts)}\n`);

        for (const item of report.items) {
          console.log(`• ${chalk.bold(item.resourceName)} (${item.type.toUpperCase()}) — Attribute: ${chalk.cyan(item.attribute)}`);
          console.log(`  Expected: ${chalk.green(JSON.stringify(item.expectedValue))}`);
          console.log(`  Actual:   ${chalk.red(JSON.stringify(item.actualValue))}\n`);
        }

        if (options.fix) {
          console.log(chalk.bold.yellow("DRIFT RECONCILIATION PLAN"));
          for (const item of report.items) {
            console.log(chalk.cyan(`  ~ UPDATE ${item.type.toUpperCase()} ${item.resourceName} (${item.attribute}: ${JSON.stringify(item.actualValue)} → ${JSON.stringify(item.expectedValue)})`));
          }
          console.log("");
          console.log(chalk.bold.cyan("Applying drift reconciliation plan..."));
          const fixResult = NovaDriftEngine.fix(report);
          for (const detail of fixResult.fixedDetails) {
            console.log(chalk.green(`  ✓ ${detail}`));
          }
          console.log(chalk.bold.green(`\nReconciled ${fixResult.fixedCount} drift item(s) successfully.\n`));
        } else {
          console.log(chalk.gray("Tip: Run `nova drift --fix` to propose and apply a drift reconciliation plan.\n"));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Drift detection failed: ${msg}`));
      }
    });
}
