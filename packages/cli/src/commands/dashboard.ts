import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { exec } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

export const dashboardCommand = () => {
  return new Command("dashboard")
    .description("Launch the NovaServe local dashboard")
    .option("-p, --port <port>", "Port to run the dashboard on", "4000")
    .action(async (options) => {
      logger.info(`Starting local dashboard on port ${options.port}...`);

      const dashboardDir = join(process.cwd(), "apps", "dashboard");
      if (existsSync(dashboardDir)) {
        const child = exec(`npm run dev -- --port ${options.port}`, { cwd: dashboardDir });
        
        child.stdout?.on('data', (data) => console.log(data.toString().trim()));
        child.stderr?.on('data', (data) => console.error(data.toString().trim()));
        
        logger.success(`Dashboard running at http://localhost:${options.port}`);
        logger.info("Press Ctrl+C to stop.");
      } else {
        logger.error("Dashboard assets not found. Are you running this in the monorepo?");
      }
    });
};
