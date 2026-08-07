<p align="center">
  <h1 align="center">◆ NovaServe</h1>
  <p align="center">
    <strong>The next-generation, cloud-agnostic serverless development framework.</strong>
  </p>
  <p align="center">
    As simple as Vercel · As powerful as Terraform · As fast as Bun
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/v/novaserve.svg?style=flat-square&color=facc15" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/dm/novaserve.svg?style=flat-square" alt="npm downloads" /></a>
    <a href="https://github.com/sazamansari/NovaServe-/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square" alt="node version" /></a>
  </p>
</p>

---

## What is NovaServe?

NovaServe is a TypeScript-first serverless framework designed to replace hundreds of lines of complex YAML configuration with clean, type-safe code. Write your infrastructure once in TypeScript and deploy seamlessly to **AWS**, **Azure**, **GCP**, **Cloudflare**, **Docker**, or **Locally** with zero code changes.

```typescript
// nova.config.ts — Zero YAML. 100% Type Safe.
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

---

## Key Features

- 🚀 **TypeScript-First Infrastructure**: Full type safety, inline documentation, and IDE autocompletion for all cloud resources.
- ☁️ **Cloud-Agnostic Engine**: Swap deployment targets (AWS Lambda, Cloudflare Workers, GCP, Azure, Docker, Local) without altering application code.
- 📊 **Visual Control Center**: Built-in interactive topology DAG graph, live streaming console logs, and resource inspector via `nova dashboard`.
- 🧠 **AI Terminal Copilot**: Terminal-native AI developer assistant via `nova ai`.
- 🔐 **Built-in Authentication**: Zero-dependency JWT, OAuth 2.0 (GitHub, Google), and route protection middleware via `@novaserve/auth`.
- ⚡ **Lightning Fast Local Emulator**: In-process dev server powered by Hono with instant hot reload.
- 🔄 **Incremental DAG Deployment**: Topological dependency graph resolution that deploys only modified components.

---

## Installation

Install the NovaServe CLI globally via npm, pnpm, or yarn:

```bash
npm install -g novaserve
# or
pnpm add -g novaserve
```

Or initialize a new project directly with `npx`:

```bash
npx nova init my-app
```

---

## Quick Start

```bash
# 1. Create a new project
nova init my-app --template basic-api

# 2. Enter project directory
cd my-app

# 3. Start local development server
nova dev

# 4. Open local visual dashboard
nova dashboard

# 5. Deploy to AWS / Cloud Provider
nova deploy
```

---

## Usage Examples

### 1. Synchronous & Asynchronous Handlers

```typescript
// src/handlers/users.ts
import type { NovaContext } from "novaserve-runtime";

// Synchronous JSON Handler
export const list = (ctx: NovaContext) => {
  return ctx.json({
    status: "ok",
    users: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ],
  });
};

// Asynchronous Async/Await Handler
export const create = async (ctx: NovaContext) => {
  const body = await ctx.body<{ name: string; email: string }>();

  if (!body?.email) {
    return ctx.badRequest("Email is required");
  }

  const user = { id: Date.now(), ...body };
  return ctx.json({ user }, 201);
};
```

### 2. Route Protection with `@novaserve/auth`

```typescript
// src/handlers/protected.ts
import { requireAuth } from "novaserve-auth";
import type { NovaContext } from "novaserve-runtime";

export const profile = requireAuth(async (ctx: NovaContext) => {
  const user = ctx.get("user");
  return ctx.json({ profile: user });
});
```

---

## Command Line Interface (CLI)

Usage: `nova [command] [options]`

| Command | Options | Description |
|---|---|---|
| `nova init [name]` | `--template <template>` | Scaffolds a new NovaServe application |
| `nova dev` | `-p, --port <port>` | Launches local Hono dev server with hot reload |
| `nova build` | `-e, --env <environment>` | Bundles serverless handlers using esbuild |
| `nova deploy` | `--provider <provider>` | Deploys DAG infrastructure to the cloud |
| `nova destroy` | `--force` | Removes all deployed cloud resources |
| `nova logs [function]` | `-f, --follow` | Streams real-time function logs |
| `nova doctor` | — | Checks system environment & credentials health |
| `nova dashboard` | `-p, --port <port>` | Opens the local visual control dashboard |
| `nova ai` | — | Launches the interactive terminal AI assistant |

---

## API Reference (Resource Builders)

| Function | Import | Description |
|---|---|---|
| `defineApp(config)` | `import { defineApp } from "novaserve"` | Primary application entrypoint configuration |
| `api.create(options)` | `import { api } from "novaserve"` | Creates HTTP API Gateway with route handlers |
| `fn.create(options)` | `import { fn } from "novaserve"` | Standalone serverless function definition |
| `storage.bucket(name, options)` | `import { storage } from "novaserve"` | Object storage bucket (AWS S3, Cloudflare R2) |
| `database.postgres(name, options)` | `import { database } from "novaserve"` | Managed relational PostgreSQL database |
| `queue.create(name, options)` | `import { queue } from "novaserve"` | Message queue worker with retry policy |
| `cron.schedule(expression, options)` | `import { cron } from "novaserve"` | Scheduled cron job worker |
| `cache.redis(name, options)` | `import { cache } from "novaserve"` | Managed Redis in-memory cache |
| `secret.define(name)` | `import { secret } from "novaserve"` | Encrypted environment secrets manager |

---

## Deploy Anywhere

Deploy your application to any cloud provider with zero code changes:

```bash
nova deploy                          # Default provider (AWS)
nova deploy --provider azure        # Microsoft Azure
nova deploy --provider gcp          # Google Cloud Platform
nova deploy --provider cloudflare   # Cloudflare Workers
nova deploy --provider docker       # Docker Containers
nova deploy --provider local        # Local In-Process Engine
```

---

## Building & Testing

To build and run tests across all monorepo packages:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run unit test suite
pnpm test

# Run TypeScript type check
pnpm typecheck
```

---

## Author & Maintainer

Designed and built by **[Md Shadab Azam Ansari](https://md-shadab-azam-ansari.vercel.app/)**.

- 🌐 **Portfolio**: [https://md-shadab-azam-ansari.vercel.app/](https://md-shadab-azam-ansari.vercel.app/)
- 🐙 **GitHub**: [@sazamansari](https://github.com/sazamansari)
- 📦 **NPM Registry**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

---

## License

[MIT](LICENSE) © Md Shadab Azam Ansari & NovaServe Contributors

