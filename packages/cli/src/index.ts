#!/usr/bin/env node

/**
 * NovaServe CLI
 *
 * The next-generation, cloud-agnostic application infrastructure framework CLI.
 *
 * Core Commands:
 *   nova init       — Create a new project
 *   nova dev        — Start local development server (emulating IR graph)
 *   nova build      — Compile application into Nova IR and bundle code
 *   nova plan       — Generate diff-driven deployment execution plan & cost estimate
 *   nova ir         — Inspect, validate, and hash Nova IR Graph (1.0.0)
 *   nova diff       — Display granular resource attribute changes
 *   nova graph      — Visualize dependency DAG & least-privilege IAM graph
 *   nova impact     — Perform blast-radius impact analysis for a resource ID
 *   nova state      — Inspect deployment state graph and lock status
 *   nova drift      — Detect live infrastructure configuration drift & auto-fix
 *   nova deploy     — Execute parallel incremental cloud deployment (supports --preview)
 *   nova rollback   — Rollback application to a previous deployment state
 *   nova deployment — Inspect deployment history and resume paused journals
 *   nova promote    — Promote application IR graph across environments (staging → production)
 *   nova destroy    — Safely tear down infrastructure
 *   nova logs       — View live correlated resource streams
 *   nova trace      — Inspect OpenTelemetry distributed trace waterfalls
 *   nova events     — Inspect event payloads and trigger local event replays
 *   nova doctor     — Run signature diagnostics & deterministic auto-fixes
 *   nova security   — Audit infrastructure for wildcard IAM, public storage, & flaws
 *   nova cost       — Infrastructure cost intelligence & optimization advice
 *   nova ai         — Intelligent AI infrastructure assistant
 *   nova add        — Add a plugin package from the NovaServe capability marketplace
 *   nova plugins    — List installed capability-gated plugins
 *   nova dashboard  — Launch local visual management console
 */

import { Command } from "commander";
import { printBanner } from "./ui/banner.js";
import { initCommand } from "./commands/init.js";
import { devCommand } from "./commands/dev.js";
import { buildCommand } from "./commands/build.js";
import { planCommand } from "./commands/plan.js";
import { irCommand } from "./commands/ir.js";
import { diffCommand } from "./commands/diff.js";
import { graphCommand } from "./commands/graph.js";
import { impactCommand } from "./commands/impact.js";
import { stateCommand } from "./commands/state.js";
import { driftCommand } from "./commands/drift.js";
import { deployCommand } from "./commands/deploy.js";
import { rollbackCommand, deploymentCommand } from "./commands/rollback.js";
import { promoteCommand } from "./commands/promote.js";
import { destroyCommand } from "./commands/destroy.js";
import { logsCommand } from "./commands/logs.js";
import { invokeCommand } from "./commands/invoke.js";
import { traceCommand } from "./commands/trace.js";
import { eventsCommand } from "./commands/events.js";
import { doctorCommand } from "./commands/doctor.js";
import { securityCommand } from "./commands/security.js";
import { costCommand } from "./commands/cost.js";
import { aiCommand } from "./commands/ai.js";
import { addCommand, pluginsCommand } from "./commands/plugins.js";
import { dashboardCommand } from "./commands/dashboard.js";

const program = new Command();

program
  .name("nova")
  .description("NovaServe — The next-generation, cloud-agnostic serverless development framework.")
  .version("1.2.0")
  .hook("preAction", () => {
    printBanner();
  });

// Register all core commands
program.addCommand(initCommand());
program.addCommand(devCommand());
program.addCommand(buildCommand());
program.addCommand(planCommand());
program.addCommand(irCommand());
program.addCommand(diffCommand());
program.addCommand(graphCommand());
program.addCommand(impactCommand());
program.addCommand(stateCommand());
program.addCommand(driftCommand());
program.addCommand(deployCommand());
program.addCommand(rollbackCommand());
program.addCommand(deploymentCommand());
program.addCommand(promoteCommand());
program.addCommand(destroyCommand());
program.addCommand(logsCommand());
program.addCommand(invokeCommand());
program.addCommand(traceCommand());
program.addCommand(eventsCommand());
program.addCommand(doctorCommand());
program.addCommand(securityCommand());
program.addCommand(costCommand());
program.addCommand(aiCommand());
program.addCommand(addCommand());
program.addCommand(pluginsCommand());
program.addCommand(dashboardCommand());

// Re-export SDK builders for seamless import from "novaserve"
export {
  defineApp,
  api,
  fn,
  function_,
  storage,
  database,
  queue,
  cron,
  cache,
  secret,
  env,
  link,
} from "novaserve-sdk";

// Parse and execute
program.parse();
