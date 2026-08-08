/**
 * `nova ir`
 *
 * Inspects, validates, and hashes the Nova Intermediate Representation (Nova IR 1.0.0).
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaCompiler, toResource } from "novaserve-core";
import { loadConfig } from "../utils/config-loader.js";

export function irCommand(): Command {
  const cmd = new Command("ir").description("Inspect, validate, and hash Nova IR Graph (1.0.0)");

  cmd
    .command("validate")
    .description("Validate Nova IR graph schema and check for circular dependencies")
    .action(async () => {
      console.log(chalk.bold.yellow("\n◆ Nova IR 1.0.0 Validation\n"));

      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });

        const { ir, validation } = compileResult;
        console.log(`Application: ${chalk.cyan(ir.app.name)}`);
        console.log(`IR Version:  ${ir.schemaVersion}`);
        console.log(`Resources:   ${Object.keys(ir.resources).length}`);
        console.log(`Dependencies:${ir.dependencies.length}\n`);

        if (validation.valid) {
          console.log(chalk.bold.green("✓ Nova IR Valid"));
          console.log(chalk.bold.green("✓ Deterministic Canonical Graph"));
          console.log(chalk.bold.green("✓ Zero Circular Dependency Cycles Detected\n"));
        } else {
          console.log(chalk.bold.red("✗ IR Validation Failed:"));
          for (const err of validation.errors) {
            console.log(chalk.red(`  • ${err}`));
          }
          console.log("");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`IR validation failed: ${msg}`));
      }
    });

  cmd
    .command("inspect")
    .description("Display raw Nova IR JSON representation")
    .action(async () => {
      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });
        console.log(JSON.stringify(compileResult.ir, null, 2));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`IR inspect failed: ${msg}`));
      }
    });

  cmd
    .command("hash")
    .description("Print canonical SHA256 hash of Nova IR graph")
    .action(async () => {
      try {
        const app = await loadConfig();
        const coreResources = (app.resources || []).map((r: any) => toResource(r));
        const compileResult = NovaCompiler.compile({
          appName: app.name || "nova-app",
          resources: coreResources,
        });
        console.log(`sha256:${compileResult.ir.app.hash}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`IR hash failed: ${msg}`));
      }
    });

  return cmd;
}
