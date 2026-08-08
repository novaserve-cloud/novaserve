/**
 * `nova security`
 *
 * Scans Nova IR and app configuration for security risks and IAM wildcards.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, NovaSecurityScanner, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function securityCommand(): Command {
  return new Command("security")
    .description("Audit infrastructure graph for wildcard IAM policies, exposed secrets, and security flaws")
    .action(async () => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Security & Audit Engine\n"));

      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });

        const report = NovaSecurityScanner.scan(compileResult.ir);

        console.log(`Audited App: ${chalk.cyan(report.appName)}`);
        console.log(`Timestamp:   ${chalk.gray(report.timestamp)}\n`);

        if (report.totalFindings === 0) {
          console.log(chalk.bold.green("✓ Zero security vulnerabilities detected! Least-privilege IAM enforced.\n"));
          return;
        }

        console.log(chalk.bold(`Findings Summary: ${report.totalFindings} Issue(s) Detected`));
        console.log(
          `  CRITICAL: ${chalk.bold.red(report.criticalCount)} | HIGH: ${chalk.bold.magenta(report.highCount)} | MEDIUM: ${chalk.bold.yellow(report.mediumCount)} | LOW: ${chalk.bold.blue(report.lowCount)}\n`
        );

        for (const finding of report.findings) {
          const badge =
            finding.severity === "CRITICAL"
              ? chalk.bgRed.white.bold(` ${finding.severity} `)
              : finding.severity === "HIGH"
              ? chalk.bgMagenta.white.bold(` ${finding.severity} `)
              : chalk.bgYellow.black.bold(` ${finding.severity} `);

          console.log(`${badge} ${chalk.bold(finding.title)} (${finding.resourceId})`);
          console.log(`  Description: ${finding.description}`);
          console.log(`  Remediation: ${chalk.cyan(finding.remediation)}\n`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Security audit failed: ${msg}`));
      }
    });
}
