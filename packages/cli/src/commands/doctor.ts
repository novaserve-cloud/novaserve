/**
 * `nova doctor` — Signature System Diagnostic & Repair Engine
 *
 * Inspects Node/Bun, credentials, bundle sizes, IAM policies, public buckets,
 * missing DLQs, and supports deterministic --fix options.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, NovaDoctorEngine, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Perform signature health, security, and bundle diagnostics with optional auto-fix")
    .option("--fix", "Automatically fix safe and deterministic diagnostic issues", false)
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Doctor Diagnostics\n"));

      let irGraph;
      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compiled = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });
        irGraph = compiled.ir;
      } catch {
        // Continue diagnosis without IR if config missing
      }

      const report = NovaDoctorEngine.diagnose(irGraph);

      for (const check of report.checks) {
        if (check.status === "pass") {
          console.log(chalk.green(`  ✓ ${check.title}`));
        } else if (check.status === "warn") {
          console.log(chalk.yellow(`  ⚠ ${check.title} — ${check.message}`));
        } else {
          console.log(chalk.red(`  ✗ ${check.title} — ${check.message}`));
        }
      }

      console.log(`\nDiagnostic Summary: ${chalk.green(`${report.passedCount} Passed`)} | ${chalk.yellow(`${report.warningCount} Warnings`)} | ${chalk.red(`${report.failedCount} Failed`)}\n`);

      if (options.fix) {
        console.log(chalk.bold.cyan("Applying safe auto-fixes..."));
        const fixResult = NovaDoctorEngine.fix(report);
        if (fixResult.fixedCount > 0) {
          for (const item of fixResult.fixedItems) {
            console.log(chalk.green(`  ✓ ${item}`));
          }
          console.log(chalk.bold.green(`\nApplied ${fixResult.fixedCount} automatic fixes successfully.\n`));
        } else {
          console.log(chalk.gray("No auto-fixable issues detected.\n"));
        }
      } else if (report.warningCount > 0) {
        console.log(chalk.gray("Tip: Run `nova doctor --fix` to automatically repair safe configuration warnings.\n"));
      }
    });
}
