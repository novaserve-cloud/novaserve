/**
 * `nova graph`
 *
 * Renders an ASCII infrastructure dependency graph.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function graphCommand(): Command {
  return new Command("graph")
    .description("Display the application infrastructure dependency graph")
    .action(async () => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Infrastructure Dependency Graph\n"));

      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });

        const { ir } = compileResult;
        console.log(`Application Graph: ${chalk.cyan(ir.app.name)} [IR Hash: ${ir.app.hash.slice(0, 8)}]\n`);

        const resourceList = Object.values(ir.resources);
        if (resourceList.length === 0) {
          console.log(chalk.gray("No resources defined."));
          return;
        }

        console.log("DAG Topology:");
        for (const res of resourceList) {
          const typeBadge = chalk.bold.cyan(`[${res.type.toUpperCase()}]`);
          console.log(`├── ${typeBadge} ${res.name} (hash: ${res.configHash.slice(0, 6)})`);

          if (res.dependencies && res.dependencies.length > 0) {
            for (const dep of res.dependencies) {
              console.log(`│   └── 🔗 Depends on: ${chalk.yellow(dep)}`);
            }
          }
        }

        if (ir.permissions && ir.permissions.length > 0) {
          console.log(`\n${chalk.bold("Inferred Least-Privilege IAM Graph:")}`);
          for (const perm of ir.permissions) {
            console.log(`├── 🛡️  ${chalk.bold.green(perm.targetFunction)}`);
            console.log(`│   ├── Actions:   ${chalk.gray(perm.actions.join(", "))}`);
            console.log(`│   └── Resources: ${chalk.gray(perm.resources.join(", "))}`);
          }
        }
        console.log("");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Graph resolution failed: ${msg}`));
      }
    });
}
