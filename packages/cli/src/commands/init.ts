/**
 * nova init — Create a new NovaServe project
 *
 * Interactive project scaffolding with template selection.
 */

import { Command } from "commander";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.js";
import { withSpinner } from "../ui/spinner.js";

const TEMPLATES = {
  "basic-api": {
    name: "REST API",
    description: "A simple REST API with CRUD routes",
    files: generateBasicApiFiles,
  },
  "cron-worker": {
    name: "Cron Worker",
    description: "Scheduled background tasks",
    files: generateCronWorkerFiles,
  },
  "vite-react": {
    name: "Vite + React",
    description: "Single Page App + Serverless Backend",
    files: generateViteReactFiles,
  },
  "nextjs": {
    name: "Next.js Fullstack",
    description: "Next.js frontend + NovaServe API backend",
    files: generateNextjsFiles,
  },
} as const;

export function initCommand(): Command {
  return new Command("init")
    .description("Create a new NovaServe project")
    .argument("[name]", "Project name")
    .option("-t, --template <template>", "Template to use", "basic-api")
    .option("--runtime <runtime>", "Default runtime", "node20")
    .option("--region <region>", "Default region", "ap-south-1")
    .action(async (name, options) => {
      const projectName = name || "my-nova-app";
      const template = options.template as keyof typeof TEMPLATES;
      const runtime = options.runtime;
      const region = options.region;

      // Validate template
      if (!(template in TEMPLATES)) {
        logger.error(`Unknown template "${template}". Available: ${Object.keys(TEMPLATES).join(", ")}`);
        process.exit(1);
      }

      const projectDir = join(process.cwd(), projectName);

      if (existsSync(projectDir)) {
        logger.error(`Directory "${projectName}" already exists`);
        process.exit(1);
      }

      await withSpinner(`Creating ${projectName}...`, async () => {
        // Create project directory
        mkdirSync(projectDir, { recursive: true });

        // Generate template files
        const templateConfig = TEMPLATES[template];
        const files = templateConfig.files(projectName, runtime, region);

        for (const [filePath, content] of Object.entries(files)) {
          const fullPath = join(projectDir, filePath);
          mkdirSync(join(fullPath, ".."), { recursive: true });
          writeFileSync(fullPath, content);
        }

        // Create package.json
        const packageJson = {
          name: projectName,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            dev: "nova dev",
            build: "nova build",
            deploy: "nova deploy",
            destroy: "nova destroy",
          },
          dependencies: {
            novaserve: "^0.1.0",
          },
          devDependencies: {
            typescript: "^5.7.0",
            "@types/node": "^22.0.0",
          },
        };

        writeFileSync(
          join(projectDir, "package.json"),
          JSON.stringify(packageJson, null, 2)
        );

        // Create tsconfig.json
        const tsconfig = {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "bundler",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            outDir: "./dist",
            rootDir: "./src",
            declaration: true,
          },
          include: ["src/**/*.ts", "nova.config.ts"],
        };

        writeFileSync(
          join(projectDir, "tsconfig.json"),
          JSON.stringify(tsconfig, null, 2)
        );
      });

      logger.blank();
      logger.success(`Created project: ${projectName}`);
      logger.blank();
      logger.info("Next steps:");
      logger.kv("", `cd ${projectName}`);
      logger.kv("", "npm install");
      logger.kv("", "nova dev        # Start local development");
      logger.kv("", "nova deploy     # Deploy to cloud");
      logger.blank();
    });
}

// ── Template Generators ──────────────────────────────

function generateBasicApiFiles(
  name: string,
  runtime: string,
  region: string
): Record<string, string> {
  return {
    "nova.config.ts": `import { defineApp, api } from "novaserve";

export default defineApp({
  name: "${name}",
  region: "${region}",
  runtime: "${runtime}",

  resources: {
    api: api.create({
      routes: {
        "GET /": "src/handlers/hello.handler",
        "GET /health": "src/handlers/health.handler",
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
        "GET /users/:id": "src/handlers/users.get",
      },
      cors: true,
    }),
  },
});
`,

    "src/handlers/hello.ts": `import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({
    message: "Hello from NovaServe! 🚀",
    timestamp: new Date().toISOString(),
  });
};
`,

    "src/handlers/health.ts": `import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({
    status: "healthy",
    uptime: process.uptime(),
    version: "0.1.0",
  });
};
`,

    "src/handlers/users.ts": `import type { NovaContext } from "novaserve/runtime";

// In-memory store for demo purposes
const users: Array<{ id: string; name: string; email: string }> = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com" },
  { id: "2", name: "Bob Smith", email: "bob@example.com" },
];

export const list = async (ctx: NovaContext) => {
  return ctx.json({ users, count: users.length });
};

export const create = async (ctx: NovaContext) => {
  const body = ctx.body<{ name: string; email: string }>();

  if (!body?.name || !body?.email) {
    return ctx.badRequest("Name and email are required");
  }

  const user = {
    id: String(users.length + 1),
    name: body.name,
    email: body.email,
  };

  users.push(user);
  return ctx.json({ user }, 201);
};

export const get = async (ctx: NovaContext) => {
  const user = users.find((u) => u.id === ctx.params.id);

  if (!user) {
    return ctx.notFound(\`User \${ctx.params.id} not found\`);
  }

  return ctx.json({ user });
};
`,

    ".gitignore": `node_modules/
dist/
.nova/
.env
`,
  };
}

function generateCronWorkerFiles(
  name: string,
  runtime: string,
  region: string
): Record<string, string> {
  return {
    "nova.config.ts": `import { defineApp, cron } from "novaserve";

export default defineApp({
  name: "${name}",
  region: "${region}",
  runtime: "${runtime}",

  resources: {
    healthCheck: cron.every("5 minutes", {
      handler: "src/workers/health-check.handler",
      description: "Check system health every 5 minutes",
    }),

    dailyReport: cron.schedule("0 9 * * *", {
      handler: "src/workers/daily-report.handler",
      description: "Generate daily report at 9 AM",
      timeout: "5m",
    }),
  },
});
`,

    "src/workers/health-check.ts": `export const handler = async () => {
  console.log("[Health Check] Running system health check...");
  console.log("[Health Check] All systems operational ✓");
};
`,

    "src/workers/daily-report.ts": `export const handler = async () => {
  console.log("[Daily Report] Generating daily report...");
  console.log("[Daily Report] Report generated successfully ✓");
};
`,

    ".gitignore": `node_modules/
dist/
.nova/
.env
`,
  };
}

function generateViteReactFiles(
  name: string,
  runtime: string,
  region: string
): Record<string, string> {
  return {
    "nova.config.ts": `import { defineApp, api, staticSite } from "novaserve";

export default defineApp({
  name: "${name}",
  region: "${region}",
  runtime: "${runtime}",

  resources: {
    frontend: staticSite.create({
      buildDir: "dist",
      buildCommand: "npm run build",
    }),
    api: api.create({
      routes: {
        "GET /api/hello": "src/api/hello.handler",
      },
    }),
  },
});
`,
    "src/api/hello.ts": `import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({ message: "Hello from NovaServe API!" });
};
`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "src/main.tsx": `import React from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <h1>Welcome to ${name} powered by NovaServe</h1>
  </React.StrictMode>
)
`,
    ".gitignore": `node_modules/
dist/
.nova/
.env
`,
  };
}

function generateNextjsFiles(
  name: string,
  runtime: string,
  region: string
): Record<string, string> {
  return {
    "nova.config.ts": `import { defineApp, api } from "novaserve";

export default defineApp({
  name: "${name}",
  region: "${region}",
  runtime: "${runtime}",

  resources: {
    api: api.create({
      routes: {
        "GET /api/v1/health": "src/api/health.handler",
      },
    }),
  },
});
`,
    "src/api/health.ts": `import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({ status: "ok", framework: "Next.js + NovaServe" });
};
`,
    "next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
`,
    ".gitignore": `node_modules/
.next/
dist/
.nova/
.env
`,
  };
}
