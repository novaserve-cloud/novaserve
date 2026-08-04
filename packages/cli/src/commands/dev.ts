/**
 * nova dev — Start local development server
 *
 * Launches the local emulator with hot reload.
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";

export function devCommand(): Command {
  return new Command("dev")
    .description("Start local development server with hot reload")
    .option("-p, --port <port>", "Port number", "3000")
    .option("--no-reload", "Disable hot reload")
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const app = await loadConfig();

      logger.box([
        { key: "App:", value: app.name },
        { key: "Mode:", value: "Development" },
        { key: "Runtime:", value: app.config.runtime || "node20" },
        { key: "Port:", value: String(port) },
      ]);

      logger.blank();

      try {
        // Dynamically import local provider to avoid bundling issues
        const { LocalProvider } = await import("@novaserve/provider-local");
        const provider = new LocalProvider({ port });

        await provider.init(app.config);

        // Convert resources
        const { toResource } = await import("@novaserve/core");
        const resources = app.resources.map(toResource);

        // Start the local server
        await provider.startDevServer(resources, {
          hotReload: options.reload !== false,
          projectRoot: process.cwd(),
        });

        logger.blank();
        logger.success(`Local server running at http://localhost:${port}`);
        logger.blank();

        // Show available routes
        for (const resource of resources) {
          if (resource.type === "api") {
            const routes = resource.config.routes as Record<string, string>;
            if (routes) {
              logger.info("Routes:");
              for (const [route] of Object.entries(routes)) {
                logger.kv("", `http://localhost:${port}${route.split(" ")[1]}`);
              }
            }
          }
        }

        logger.blank();
        logger.info("Press Ctrl+C to stop");
      } catch (error) {
        logger.error(
          `Failed to start dev server: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
