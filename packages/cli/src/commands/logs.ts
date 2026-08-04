/**
 * nova logs — View function logs
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";

export function logsCommand(): Command {
  return new Command("logs")
    .description("View function logs")
    .argument("[function]", "Function name to view logs for")
    .option("-f, --follow", "Follow mode (tail logs)")
    .option("-n, --lines <count>", "Number of lines to show", "50")
    .option("--since <time>", "Show logs since (e.g., 5m, 1h, 2d)")
    .action(async (functionName, options) => {
      const app = await loadConfig();

      logger.box([
        { key: "App:", value: app.name },
        { key: "Action:", value: "View Logs" },
        { key: "Function:", value: functionName || "all" },
        { key: "Mode:", value: options.follow ? "Follow" : "Static" },
      ]);

      logger.blank();
      logger.info("Log streaming will be available once a provider is connected.");
      logger.info("For local development, use: nova dev (logs appear in terminal)");
      logger.blank();
    });
}
