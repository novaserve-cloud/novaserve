/**
 * nova build — Build functions for deployment
 */

import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { loadConfig } from "../utils/config-loader.js";
import { withSpinner } from "../ui/spinner.js";
import { Bundler, toResource } from "@novaserve/core";

export function buildCommand(): Command {
  return new Command("build")
    .description("Build functions for deployment")
    .option("--no-minify", "Disable minification")
    .option("--sourcemap", "Include source maps", true)
    .action(async (options) => {
      const app = await loadConfig();

      logger.box([
        { key: "App:", value: app.name },
        { key: "Action:", value: "Build" },
      ]);

      const resources = app.resources.map(toResource);
      const bundler = new Bundler(process.cwd());

      // Extract handlers from resources
      const handlers: Array<{ name: string; entryPoint: string }> = [];

      for (const resource of resources) {
        if (resource.type === "api") {
          const routes = resource.config.routes as Record<string, string> | undefined;
          if (routes) {
            for (const [route, handler] of Object.entries(routes)) {
              const [method, path] = route.split(" ");
              const name = `api-${method?.toLowerCase()}-${path?.replace(/[/:]/g, "-").replace(/^-/, "")}`;
              const [filePath] = handler.split(".");
              handlers.push({ name, entryPoint: `${filePath}.ts` });
            }
          }
        } else if (resource.config.handler) {
          const handler = resource.config.handler as string;
          const [filePath] = handler.split(".");
          handlers.push({
            name: `${resource.type}-${resource.name}`,
            entryPoint: `${filePath}.ts`,
          });
        }
      }

      if (handlers.length === 0) {
        logger.warn("No handlers found to build");
        return;
      }

      const results = await withSpinner(
        `Building ${handlers.length} function(s)...`,
        () => bundler.bundleAll(handlers)
      );

      logger.blank();
      logger.info("Build results:");

      for (const [name, result] of results) {
        const sizeStr = Bundler.formatSize(result.size);
        const timeStr = `${result.durationMs}ms`;
        logger.kv(`  ${name}`, `${sizeStr} (${timeStr})`);
      }

      logger.blank();
      logger.success(`Built ${handlers.length} function(s) successfully`);
      logger.blank();
    });
}
