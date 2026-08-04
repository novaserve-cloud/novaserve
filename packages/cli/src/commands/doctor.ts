/**
 * nova doctor — Check system health
 *
 * Validates the development environment and configuration.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { logger } from "../utils/logger.js";

interface Check {
  name: string;
  check: () => { ok: boolean; message: string };
}

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Check system health and configuration")
    .action(async () => {
      logger.info("Running system checks...\n");

      const checks: Check[] = [
        {
          name: "Node.js",
          check: () => {
            const version = process.version;
            const major = parseInt(version.slice(1).split(".")[0]!, 10);
            return {
              ok: major >= 20,
              message: major >= 20
                ? `${version} ✓`
                : `${version} (requires >= 20)`,
            };
          },
        },
        {
          name: "npm",
          check: () => {
            try {
              const version = execSync("npm --version", { encoding: "utf-8" }).trim();
              return { ok: true, message: `v${version} ✓` };
            } catch {
              return { ok: false, message: "Not found" };
            }
          },
        },
        {
          name: "pnpm",
          check: () => {
            try {
              const version = execSync("pnpm --version", { encoding: "utf-8" }).trim();
              return { ok: true, message: `v${version} ✓` };
            } catch {
              return { ok: false, message: "Not installed (optional)" };
            }
          },
        },
        {
          name: "Git",
          check: () => {
            try {
              const version = execSync("git --version", { encoding: "utf-8" }).trim();
              return { ok: true, message: `${version} ✓` };
            } catch {
              return { ok: false, message: "Not found" };
            }
          },
        },
        {
          name: "Config File",
          check: () => {
            const configFiles = [
              "nova.config.ts",
              "nova.config.js",
              "nova.config.mts",
            ];
            const found = configFiles.find((f) =>
              existsSync(join(process.cwd(), f))
            );
            return {
              ok: !!found,
              message: found ? `${found} ✓` : "Not found (run nova init)",
            };
          },
        },
        {
          name: "AWS CLI",
          check: () => {
            try {
              const version = execSync("aws --version", { encoding: "utf-8" }).trim();
              return { ok: true, message: `${version.split(" ")[0]} ✓` };
            } catch {
              return { ok: false, message: "Not installed (needed for AWS deployments)" };
            }
          },
        },
        {
          name: "Docker",
          check: () => {
            try {
              const version = execSync("docker --version", { encoding: "utf-8" }).trim();
              return { ok: true, message: `${version.split(",")[0]} ✓` };
            } catch {
              return { ok: false, message: "Not installed (optional)" };
            }
          },
        },
      ];

      let allPassed = true;

      for (const check of checks) {
        const result = check.check();
        if (result.ok) {
          logger.success(`${check.name.padEnd(15)} ${result.message}`);
        } else {
          logger.warn(`${check.name.padEnd(15)} ${result.message}`);
          if (check.name === "Node.js" || check.name === "Config File") {
            allPassed = false;
          }
        }
      }

      logger.blank();

      if (allPassed) {
        logger.success("All required checks passed! You're ready to go. 🚀");
      } else {
        logger.warn("Some checks failed. Fix the issues above before proceeding.");
      }

      logger.blank();
    });
}
