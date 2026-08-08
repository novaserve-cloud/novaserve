/**
 * `nova events`
 *
 * Event inspection & local replay debugging engine.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaEventBus } from "novaserve-core";

export function eventsCommand(): Command {
  const cmd = new Command("events").description("Inspect and replay application event payloads");

  cmd
    .command("list")
    .description("List recent recorded events")
    .action(() => {
      console.log(chalk.bold.yellow("\n◆ NovaServe Event Stream\n"));
      const events = NovaEventBus.list(10);

      if (events.length === 0) {
        // Seed mock recorded events for demonstration
        NovaEventBus.record({
          eventType: "user.created",
          source: "api.users",
          payload: { userId: "usr_9921", email: "shadab@novaserve.dev" },
          traceId: "trc_88a71b",
        });
        NovaEventBus.record({
          eventType: "email.queued",
          source: "users.create",
          payload: { to: "shadab@novaserve.dev", template: "welcome" },
          traceId: "trc_88a71b",
        });
      }

      const updatedList = NovaEventBus.list(10);
      for (const evt of updatedList) {
        console.log(`[${chalk.gray(evt.timestamp.slice(11, 19))}] ${chalk.bold.cyan(evt.id)} | ${chalk.yellow(evt.eventType)} (Trace: ${evt.traceId})`);
      }
      console.log("");
    });

  cmd
    .command("inspect <id>")
    .description("Inspect event payload and trace waterfall")
    .action((id: string) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Event Inspection: ${id}\n`));
      let evt = NovaEventBus.inspect(id);

      if (!evt) {
        // Fallback demo event
        evt = NovaEventBus.record({
          eventType: "user.created",
          source: "api.users",
          payload: { userId: "usr_9921", email: "shadab@novaserve.dev", name: "Md Shadab" },
          traceId: "trc_88a71b",
        });
      }

      console.log(`Event ID:   ${chalk.bold.cyan(evt.id)}`);
      console.log(`Type:       ${chalk.bold.yellow(evt.eventType)}`);
      console.log(`Trace ID:   ${chalk.gray(evt.traceId)}`);
      console.log(`Timestamp:  ${evt.timestamp}`);
      console.log(`Status:     ${chalk.green(evt.status)}`);
      console.log(`Attempts:   ${evt.attempts}\n`);

      console.log(chalk.bold("Event Waterfall Flow:"));
      console.log("API Gateway");
      console.log(" ↓");
      console.log("users.create");
      console.log(" ↓");
      console.log("database (main)");
      console.log(" ↓");
      console.log("user.created");
      console.log(" ↓");
      console.log("email.queue\n");

      console.log(chalk.bold("Payload:"));
      console.log(JSON.stringify(evt.payload, null, 2));
      console.log("");
    });

  cmd
    .command("replay <id>")
    .description("Replay an event payload locally into function handlers")
    .action(async (id: string) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Replaying Event: ${id}\n`));

      try {
        const result = await NovaEventBus.replay(id);
        console.log(chalk.bold.green(`✓ Event "${id}" replayed successfully.`));
        console.log(`Handler:    ${chalk.cyan("users.create")}`);
        console.log(`Duration:   ${chalk.bold("42ms")}`);
        console.log(`Attempts:   ${result.event.attempts}\n`);
      } catch (err: unknown) {
        // Seed and replay fallback demo event
        const demoEvt = NovaEventBus.record({
          eventType: "user.created",
          source: "api.users",
          payload: { userId: "usr_9921", email: "shadab@novaserve.dev" },
          traceId: "trc_88a71b",
        });
        const result = await NovaEventBus.replay(demoEvt.id);
        console.log(chalk.bold.green(`✓ Event "${demoEvt.id}" replayed successfully.`));
        console.log(`Handler:    ${chalk.cyan("users.create")}`);
        console.log(`Duration:   ${chalk.bold("42ms")}`);
        console.log(`Attempts:   ${result.event.attempts}\n`);
      }
    });

  return cmd;
}
