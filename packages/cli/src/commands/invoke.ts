/**
 * `nova invoke`
 *
 * Synchronously invokes a deployed cloud function (e.g. AWS Lambda)
 * passing a payload and returning the actual execution response.
 */

import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";

export function invokeCommand(): Command {
  return new Command("invoke")
    .description("Invoke a deployed function synchronously on the active provider")
    .argument("<function>", "Target function name to invoke")
    .option("-p, --payload <json>", "JSON string payload to pass to the function", "{}")
    .option("-e, --env <environment>", "Target environment", "production")
    .action(async (functionName: string, options) => {
      console.log(chalk.bold.yellow(`\n◆ NovaServe Function Invoke: ${functionName}\n`));

      try {
        const app = await loadConfig();
        const providerName = app.config.provider || "aws";

        let payloadObj: unknown = {};
        try {
          payloadObj = JSON.parse(options.payload);
        } catch {
          console.log(chalk.red(`Invalid JSON payload: "${options.payload}"`));
          process.exit(1);
        }

        console.log(`Provider:    ${chalk.bold.magenta(providerName.toUpperCase())}`);
        console.log(`Function:    ${chalk.cyan(functionName)}`);
        console.log(`Payload:     ${chalk.gray(options.payload)}\n`);

        let result: { statusCode: number; body: unknown; durationMs: number; logResult?: string };

        if (providerName === "aws") {
          const { AWSProvider } = await import("novaserve-provider-aws");
          const provider = new AWSProvider();
          await provider.init(app.config);
          result = await provider.invoke(functionName, payloadObj);
        } else {
          const { LocalProvider } = await import("novaserve-provider-local");
          const provider = new LocalProvider({});
          await provider.init(app.config);
          result = await provider.invoke(functionName, payloadObj);
        }

        console.log(chalk.bold("Response:"));
        console.log(`Status Code: ${result.statusCode >= 400 ? chalk.red(result.statusCode) : chalk.green(result.statusCode)}`);
        console.log(`Duration:    ${chalk.cyan(`${result.durationMs}ms`)}\n`);

        console.log(chalk.bold("Payload Response:"));
        console.log(JSON.stringify(result.body, null, 2));

        if (result.logResult) {
          console.log(chalk.bold("\nExecution Log Tail:"));
          console.log(chalk.gray(result.logResult));
        }

        console.log("");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Invoke failed: ${msg}`);
        process.exit(1);
      }
    });
}
