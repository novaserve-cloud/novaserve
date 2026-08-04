#!/usr/bin/env node

/**
 * NovaServe CLI
 *
 * The beautiful command-line interface for NovaServe.
 *
 * Commands:
 *   nova init      — Create a new project
 *   nova dev       — Start local development server
 *   nova build     — Build functions for deployment
 *   nova deploy    — Deploy to the cloud
 *   nova destroy   — Remove all deployed resources
 *   nova logs      — View function logs
 *   nova doctor    — Check system health
 */

import { Command } from "commander";
import { printBanner } from "./ui/banner.js";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { buildCommand } from "./commands/build.js";
import { deployCommand } from "./commands/deploy.js";
import { destroyCommand } from "./commands/destroy.js";
import { logsCommand } from "./commands/logs.js";
import { doctorCommand } from "./commands/doctor.js";

const program = new Command();

program
  .name("nova")
  .description("NovaServe — The future of serverless development")
  .version("0.1.0")
  .hook("preAction", () => {
    printBanner();
  });

// Register commands
program.addCommand(initCommand());
program.addCommand(devCommand());
program.addCommand(buildCommand());
program.addCommand(deployCommand());
program.addCommand(destroyCommand());
program.addCommand(logsCommand());
program.addCommand(doctorCommand());

// Parse and execute
program.parse();
