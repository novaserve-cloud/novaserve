/**
 * `nova diff`
 *
 * Shows granular resource configuration diffs.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, NovaPlanner, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function diffCommand(): Command {
  return new Command("diff")
    .description("Display fine-grained resource attribute changes")
    .option("-p, --provider <name>", "Target cloud provider", "aws")
    .action(async (options) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Infrastructure Diff\n"));

      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          targetProvider: options.provider,
          resources: coreResources,
        });

        // Simulate state with slight variation for diff demonstration
        const mockState: Record<string, { configHash: string; config: Record<string, unknown> }> = {};
        for (const r of coreResources) {
          if (r.type === "function") {
            mockState[`${r.type}-${r.name}`] = {
              configHash: "diff_old_hash_01",
              config: { ...r.config, memory: 512 },
            };
          }
        }

        const plan = NovaPlanner.plan(compileResult.ir, mockState, options.provider);

        for (const action of plan.actions) {
          console.log(chalk.bold(`${action.resourceType.toUpperCase()}`));
          if (action.action === "create") {
            console.log(chalk.green(`  + ${action.name}`));
          } else if (action.action === "update") {
            console.log(chalk.yellow(`  ~ ${action.name}`));
            if (action.diffs && action.diffs.length > 0) {
              for (const d of action.diffs) {
                console.log(chalk.gray(`    ${d.attribute}: ${String(d.oldValue)} → ${String(d.newValue)}`));
              }
            }
          } else {
            console.log(chalk.gray(`  no changes`));
          }
          console.log("");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Diff failed: ${msg}`));
      }
    });
}
