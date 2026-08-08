/**
 * `nova plugins` & `nova add`
 *
 * Secure plugin installation and management with capability-gated permissions.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaPluginManager } from "novaserve-core";

export function pluginsCommand(): Command {
  const cmd = new Command("plugins").description("Manage capability-gated NovaServe plugins");

  cmd
    .command("list")
    .description("List installed NovaServe plugins")
    .action(() => {
      console.log(chalk.bold.yellow("\n◆ Installed NovaServe Plugins\n"));
      const plugins = NovaPluginManager.list();

      if (plugins.length === 0) {
        // Seed default marketplace plugins for demonstration
        NovaPluginManager.install("stripe");
        NovaPluginManager.install("prisma");
      }

      const updated = NovaPluginManager.list();
      for (const p of updated) {
        console.log(`• ${chalk.bold.cyan(p.name)} (v${p.version})`);
        console.log(`  ${p.description}`);
        console.log(`  Capabilities: ${chalk.yellow(p.requiredCapabilities.join(", "))}\n`);
      }
    });

  return cmd;
}

export function addCommand(): Command {
  return new Command("add")
    .description("Add a plugin package from the NovaServe capability marketplace")
    .argument("<pluginName>", "Plugin identifier (e.g. stripe, prisma, resend)")
    .action((pluginName: string) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Plugin Installer: ${pluginName}\n`));

      try {
        const pkg = NovaPluginManager.install(pluginName);
        console.log(chalk.bold.green(`✓ Installed plugin ${pkg.name}@${pkg.version}`));
        console.log(`  Description: ${pkg.description}`);
        console.log(`  Capabilities Granted: ${chalk.cyan(pkg.requiredCapabilities.join(", "))}\n`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`Plugin installation failed: ${msg}`));
      }
    });
}
