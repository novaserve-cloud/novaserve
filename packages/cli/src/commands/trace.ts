/**
 * `nova trace`
 *
 * OpenTelemetry distributed trace waterfall viewer.
 */

import { Command } from "commander";
import chalk from "chalk";
import { NovaTelemetry } from "novaserve-core";

export function traceCommand(): Command {
  return new Command("trace")
    .description("Inspect OpenTelemetry distributed traces and span waterfalls")
    .argument("[traceId]", "Specific trace ID to inspect")
    .action((traceId?: string) => {
      console.log(chalk.bold.yellow("\n◆ NovaServe OpenTelemetry Trace Viewer\n"));

      if (!traceId) {
        // List recent traces
        const traces = NovaTelemetry.listTraces(5);
        if (traces.length === 0) {
          // Seed demonstration trace
          const t = NovaTelemetry.startTrace("my-nova-app", "production");
          NovaTelemetry.recordSpan(t.traceId, {
            name: "GET /users",
            resourceId: "api-api",
            kind: "SERVER",
            status: "OK",
            durationMs: 142,
            attributes: { httpMethod: "GET", httpStatus: 200 },
          });
          NovaTelemetry.recordSpan(t.traceId, {
            name: "users.list",
            resourceId: "function-usersList",
            kind: "INTERNAL",
            status: "OK",
            durationMs: 85,
            attributes: { memoryUsedMb: 128 },
          });
          NovaTelemetry.recordSpan(t.traceId, {
            name: "postgres.query",
            resourceId: "database-main",
            kind: "CLIENT",
            status: "OK",
            durationMs: 42,
            attributes: { query: "SELECT * FROM users" },
          });
          traceId = t.traceId;
        }
      }

      const trace = traceId ? NovaTelemetry.getTrace(traceId) : NovaTelemetry.listTraces(1)[0];
      if (!trace) {
        console.log(chalk.red(`Trace ID "${traceId}" not found.`));
        return;
      }

      console.log(`Trace ID:       ${chalk.bold.cyan(trace.traceId)}`);
      console.log(`Application:    ${chalk.yellow(trace.appName)} (${trace.environment})`);
      console.log(`Duration:       ${chalk.bold.green(`${trace.totalDurationMs}ms`)}`);
      console.log(`Status:         ${trace.hasError ? chalk.red("ERROR") : chalk.green("OK")}\n`);

      console.log(chalk.bold("Span Waterfall:"));
      for (const span of trace.spans) {
        console.log(`├── [${chalk.bold.cyan(span.kind)}] ${chalk.bold(span.name)} (${chalk.yellow(span.resourceId)})`);
        console.log(`│   ├── Duration: ${span.durationMs}ms | Status: ${span.status === "OK" ? chalk.green("OK") : chalk.red("ERROR")}`);
        console.log(`│   └── Attributes: ${chalk.gray(JSON.stringify(span.attributes))}`);
      }
      console.log("");
    });
}
