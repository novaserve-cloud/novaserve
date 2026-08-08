/**
 * `nova impact`
 *
 * Performs blast-radius analysis to determine direct & indirect dependent resources
 * and production risk when modifying a specific resource in Nova IR.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, NovaImpactAnalyzer, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function impactCommand(): Command {
  return new Command("impact")
    .description("Analyze blast-radius impact and dependent resources for a target resource ID")
    .argument("<resourceId>", "Target resource identifier (e.g. database, uploads, emails)")
    .action(async (resourceId: string) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Blast-Radius & Impact Analysis: ${resourceId}\n`));

      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });

        const impact = NovaImpactAnalyzer.analyze(compileResult.ir, resourceId);

        const badge =
          impact.riskLevel === "HIGH"
            ? chalk.bgRed.white.bold(` RISK: ${impact.riskLevel} `)
            : impact.riskLevel === "MEDIUM"
            ? chalk.bgYellow.black.bold(` RISK: ${impact.riskLevel} `)
            : chalk.bgGreen.black.bold(` RISK: ${impact.riskLevel} `);

        console.log(`Target Resource:   ${chalk.bold.cyan(impact.targetName)} (${impact.targetType.toUpperCase()})`);
        console.log(`Production Risk:   ${badge}`);
        console.log(`Total Dependents:  ${chalk.bold.yellow(impact.totalAffected)}\n`);

        console.log(chalk.bold("Direct Dependents:"));
        if (impact.directDependents.length === 0) {
          console.log(chalk.gray("  • None"));
        } else {
          for (const d of impact.directDependents) {
            console.log(`  • ${chalk.green(d)}`);
          }
        }

        console.log(chalk.bold("\nIndirect Dependents:"));
        if (impact.indirectDependents.length === 0) {
          console.log(chalk.gray("  • None"));
        } else {
          for (const ind of impact.indirectDependents) {
            console.log(`  • ${chalk.yellow(ind)}`);
          }
        }

        if (impact.affectedRoutes.length > 0) {
          console.log(chalk.bold("\nAffected HTTP Routes:"));
          for (const route of impact.affectedRoutes) {
            console.log(`  • ${chalk.cyan(route)}`);
          }
        }

        console.log(`\nSummary: ${impact.explanation}\n`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Impact analysis failed: ${msg}`));
      }
    });
}
