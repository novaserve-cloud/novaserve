import { Command } from "commander";
import chalk from "chalk";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";

export function logsCommand(): Command {
  return new Command("logs")
    .description("View and stream live CloudWatch function logs")
    .argument("[function]", "Function name to view logs for")
    .option("-f, --follow", "Follow mode (tail live logs)")
    .option("-n, --lines <count>", "Number of log events to fetch", "50")
    .action(async (functionName, options) => {
      const app = await loadConfig();
      const targetFunction = functionName || "usersList";

      logger.box([
        { key: "App:", value: app.name },
        { key: "Target Function:", value: targetFunction },
        { key: "Provider:", value: (app.config.provider || "aws").toUpperCase() },
        { key: "Mode:", value: options.follow ? "Tail/Follow" : "Snapshot" },
      ]);

      try {
        const { AWSProvider } = await import("novaserve-provider-aws");
        const provider = new AWSProvider();
        await provider.init(app.config);

        logger.info(`Fetching live CloudWatch logs for /aws/lambda/${app.name}-${targetFunction}...`);
        logger.blank();

        const limit = parseInt(options.lines) || 50;
        let count = 0;

        for await (const entry of provider.getLogs(targetFunction, { limit, follow: options.follow })) {
          count++;
          const timeStr = entry.timestamp.toISOString().replace("T", " ").replace("Z", "");
          const levelBadge =
            entry.level === "error"
              ? chalk.bgRed.black(" ERROR ")
              : entry.level === "warn"
              ? chalk.bgYellow.black(" WARN  ")
              : chalk.bgBlue.black(" INFO  ");

          console.log(`${chalk.gray(timeStr)} ${levelBadge} ${entry.message}`);
        }

        if (count === 0) {
          logger.warn(`No recent log events found for /aws/lambda/${app.name}-${targetFunction}.`);
        }

        logger.blank();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to stream logs: ${msg}`);
        process.exit(1);
      }
    });
}
