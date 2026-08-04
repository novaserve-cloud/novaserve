<p align="center">
  <h1 align="center">◆ NovaServe</h1>
  <p align="center">
    <strong>The future of serverless development</strong>
  </p>
  <p align="center">
    As simple as Vercel · As powerful as Terraform · As fast as Bun
  </p>
</p>

---

## What is NovaServe?

NovaServe is a next-generation, cloud-agnostic serverless framework that replaces hundreds of lines of YAML with TypeScript-first configuration, supports every major cloud provider with zero code changes, and includes built-in local development with hot reload.

```typescript
// nova.config.ts — That's it. No YAML. Ever.
import { defineApp, api, storage, queue } from "novaserve";

export default defineApp({
  name: "my-app",
  region: "ap-south-1",
  runtime: "node20",

  resources: {
    api: api.create({
      routes: {
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
      },
      cors: true,
    }),

    uploads: storage.bucket("uploads", { maxSize: "10mb" }),

    emailQueue: queue.create("emails", {
      handler: "src/handlers/email.process",
      retries: 3,
    }),
  },
});
```

## Features

🚀 **TypeScript-First** — No YAML. Full type safety and autocompletion.

☁️ **Cloud-Agnostic** — Deploy to AWS, Azure, GCP, Cloudflare, Docker, or locally. Same code.

📊 **Local Dashboard** — Visual topology graph, live metric streams, and deployment history via `nova dashboard`.

🧠 **AI Companion** — Terminal-native AI developer assistant via `nova ai`.

🔐 **Built-in Authentication** — `@novaserve/auth` with zero-dependency JWT, OAuth 2.0 (GitHub, Google), and route protection middleware.

🔌 **Extensible Plugin System** — `NovaPlugin` lifecycle hooks (`preBuild`, `postBuild`, `preDeploy`, `postDeploy`).

⚡ **Blazing Fast Local Dev** — Hono-based dev server with hot reload. No Docker required.

📦 **Zero Config** — Auto-detects handlers, bundles with esbuild, generates IAM policies.

🔄 **Incremental Deploys** — Only deploys what changed. DAG topological resolution.

🎯 **Fullstack Templates** — Scaffolding for REST APIs, Cron Workers, Vite/React, and Next.js apps via `nova init`.

## Quick Start

```bash
# Create a new project
npx nova init my-app

# Start local development
cd my-app
nova dev

# Deploy to the cloud
nova deploy
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `nova init` | Create a new project |
| `nova dev` | Start local dev server with hot reload |
| `nova build` | Bundle functions for deployment |
| `nova deploy` | Deploy to the cloud |
| `nova destroy` | Remove all deployed resources |
| `nova logs` | View function logs |
| `nova doctor` | Check system health |

## Supported Resources

| Resource | Builder | Description |
|----------|---------|-------------|
| API | `api.create()` | HTTP API with route mapping |
| Function | `fn.create()` | Standalone serverless function |
| Storage | `storage.bucket()` | Object storage (S3, R2, GCS) |
| Database | `database.postgres()` | Managed database |
| Queue | `queue.create()` | Message queue with handler |
| Cron | `cron.schedule()` | Scheduled tasks |
| Cache | `cache.redis()` | Managed cache |
| Secret | `secret.define()` | Encrypted secrets |

## Handler Example

```typescript
// src/handlers/users.ts
import type { NovaContext } from "novaserve/runtime";

export const list = async (ctx: NovaContext) => {
  const users = await db.query("SELECT * FROM users");
  return ctx.json({ users });
};

export const create = async (ctx: NovaContext) => {
  const body = ctx.body<{ name: string; email: string }>();

  if (!body?.name) {
    return ctx.badRequest("Name is required");
  }

  const user = await db.insert("users", body);
  return ctx.json({ user }, 201);
};
```

## Deploy Anywhere

```bash
nova deploy              # Default provider (AWS)
nova deploy --provider azure
nova deploy --provider gcp
nova deploy --provider cloudflare
nova deploy --provider docker
nova deploy --provider local
```

Zero code changes between providers.

## Architecture

```
novaserve/
├── packages/
│   ├── sdk/             # TypeScript SDK (defineApp, resource builders)
│   ├── core/            # Engine (parser, graph, bundler, deployer)
│   ├── cli/             # CLI application
│   ├── runtime/         # Universal handler runtime
│   └── providers/
│       ├── aws/         # AWS Lambda, API Gateway, S3, SQS
│       ├── local/       # Local dev server (Hono + hot reload)
│       ├── azure/       # (coming soon)
│       ├── gcp/         # (coming soon)
│       └── cloudflare/  # (coming soon)
├── templates/           # Starter templates
├── examples/            # Usage examples
└── docs/                # Documentation
```

## Tech Stack

- **Language**: TypeScript
- **Bundler**: esbuild (blazing fast)
- **Local Server**: Hono
- **CLI**: Commander.js + chalk + ora
- **Monorepo**: pnpm + Turborepo
- **State**: JSON (SQLite planned)

## Contributing

We welcome contributions! See our [Contributing Guide](./docs/contributing.md).

## License

MIT © NovaServe Contributors
