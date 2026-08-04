# Getting Started with NovaServe

## Prerequisites

- Node.js >= 20.0.0
- npm, pnpm, or yarn

## Installation

```bash
# Install globally
npm install -g novaserve

# Or use npx
npx nova init my-app
```

## Create Your First Project

```bash
nova init my-api --template basic-api
cd my-api
npm install
```

This creates a project with:
- `nova.config.ts` — Your infrastructure configuration
- `src/handlers/` — Your API handlers
- `package.json` — Project dependencies

## Local Development

```bash
nova dev
```

This starts a local server at `http://localhost:3000` with:
- Hot reload (file changes are picked up automatically)
- API Gateway emulation
- Lambda-compatible context

## Write a Handler

```typescript
// src/handlers/hello.ts
import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({
    message: "Hello from NovaServe! 🚀",
    method: ctx.method,
    path: ctx.path,
    query: ctx.query,
  });
};
```

## Deploy

```bash
# Build and deploy
nova deploy

# Deploy to a specific environment
nova deploy --env staging

# Dry run (show plan without deploying)
nova deploy --dry-run
```

## Configuration Reference

```typescript
import { defineApp, api, storage, queue, cron, cache } from "novaserve";

export default defineApp({
  // Required
  name: "my-app",

  // Optional (with defaults)
  region: "us-east-1",       // Default region
  runtime: "node20",         // Default runtime
  memory: 256,               // Default memory (MB)
  timeout: 30,               // Default timeout (seconds)
  provider: "aws",           // Default provider

  // Resources
  resources: {
    // ...your infrastructure
  },

  // Environment overrides
  environments: {
    production: { region: "us-east-1" },
    staging: { region: "ap-south-1" },
  },

  // Tags for cloud resources
  tags: {
    project: "my-app",
    team: "engineering",
  },
});
```

## Next Steps

- [Resource Builders](./resources.md) — API, Storage, Queue, Cron, etc.
- [Providers](./providers.md) — AWS, Azure, GCP, Cloudflare
- [Deployment](./deployment.md) — Deploy, rollback, environments
- [Local Development](./local-development.md) — Hot reload, emulators
