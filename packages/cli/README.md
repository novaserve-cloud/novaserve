# NovaServe

**The TypeScript compiler for cloud infrastructure.**

Write TypeScript. Compile to AWS, Azure, GCP, Cloudflare, Docker, or Kubernetes.

> Like `tsc` for your infrastructure — one codebase, any cloud.

[![npm version](https://img.shields.io/npm/v/novaserve.svg?style=flat-square&color=6366f1)](https://www.npmjs.com/package/novaserve)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/novaserve-cloud/novaserve/ci.yml?style=flat-square&label=CI)](https://github.com/novaserve-cloud/novaserve/actions)

---

## Get Started

```bash
# 1. Initialize a new project
npx novaserve@latest init my-api

# 2. Enter project directory and install dependencies
cd my-api
npm install

# 3. Start local development server with hot-reload
nova dev
```

---

## Why NovaServe?

- **TypeScript-Native**: Infrastructure declared in pure TypeScript sharing the same types as runtime code.
- **Compiler-Driven**: Evaluates dependency DAGs and emits canonical, diffable Nova Intermediate Representation (Nova IR).
- **Multi-Cloud Target Matrix**: Write once; deploy to AWS, Cloudflare, Azure, GCP, Docker, or Kubernetes.
- **Instant Local Development**: Built-in in-process Hono emulator with millisecond hot reloading — no local cloud emulation credentials needed.
- **Deterministic Planning**: Preview exact resource diffs and monthly cost projections (`nova plan`) before applying.

---

## How It Works

```text
TypeScript Application Spec (nova.config.ts)
                    ↓
              Nova Compiler
                    ↓
      Nova Intermediate Representation (Nova IR 1.0.0)
                    ↓
         Deterministic Planner & Diff Engine
                    ↓
               Provider Adapter
                    ↓
   AWS / Cloudflare / Docker / Local / Azure / GCP
```

---

## Example

`nova.config.ts`:

```typescript
import { defineApp, api, storage, queue } from "novaserve";

export default defineApp({
  name: "order-service",
  region: "us-east-1",
  runtime: "node20",

  resources: {
    // HTTP API Gateway
    api: api.create({
      routes: {
        "GET /health": "src/handlers/health.handler",
        "POST /orders": "src/handlers/orders.create",
      },
      cors: true,
    }),

    // SQS Background Queue
    orderQueue: queue.create("order-events", {
      retries: 3,
    }),

    // S3 Object Storage Bucket
    receipts: storage.bucket("order-receipts", {
      maxSize: "10mb",
    }),
  },
});
```

Handler (`src/handlers/orders.ts`):

```typescript
import type { NovaContext } from "novaserve/runtime";

export const create = async (ctx: NovaContext) => {
  const body = ctx.body<{ item: string; quantity: number }>();
  return ctx.json({ status: "created", item: body.item }, 201);
};
```

---

## Provider Support Matrix

| Provider | Status | Capabilities |
|---|:---:|---|
| **Local** | **Production** | In-process HTTP emulator, in-memory queues & storage |
| **AWS** | **Production** | API Gateway v2, Lambda, S3, SQS, DynamoDB, IAM |
| **Cloudflare** | Experimental | Cloudflare Workers, R2 Buckets, D1 Database, KV |
| **Docker** | Experimental | Docker Compose containerization for local/on-prem |
| **Kubernetes** | Experimental | Native K8s deployment and service manifests |
| **Azure** | Experimental | Azure Functions, Blob Storage |
| **GCP** | Experimental | Cloud Functions, Cloud Storage, Pub/Sub |

---

## Platform Comparison

| Metric | NovaServe | Serverless Framework | SST (v3) | Terraform / Pulumi |
|---|:---:|:---:|:---:|:---:|
| **Paradigm** | **Compiler (IR-based)** | YAML Templates | Pulumi Wrapper | Engine & State |
| **Type Safety** | **100% Native TypeScript** | None | TypeScript | HCL / Multi-lang |
| **Local Dev** | **In-Process Emulator** | Plugins | Cloud Tunnels | None |
| **IAM Scoping** | **Auto Least-Privilege** | Manual | Partial | Manual |
| **Cost Estimates** | **Built-in (`nova plan`)** | None | None | Third-party |

---

## CLI Commands

| Command | Description |
|---|---|
| `nova init [name]` | Scaffold a new NovaServe project |
| `nova dev` | Start local development server with hot-reload |
| `nova build` | Bundle function handlers using esbuild |
| `nova plan` | Preview execution diff and cost impact |
| `nova deploy` | Deploy application to target cloud provider |
| `nova destroy` | Safely teardown deployed infrastructure |
| `nova doctor` | Verify system, credentials, and configuration health |

---

## Documentation

Full guides and references are available in the [docs/](docs/) directory:

- [Getting Started & Installation](docs/getting-started/installation.md)
- [Quick Start Guide](docs/getting-started/quick-start.md)
- [How NovaServe Works](docs/concepts/how-novaserve-works.md)
- [Nova IR Architecture](docs/concepts/nova-ir.md)
- [AWS Provider Deployment](docs/providers/aws.md)
- [CLI Reference](docs/cli/init.md)

---

## Contributing

We welcome contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before submitting pull requests.

```bash
git clone https://github.com/novaserve-cloud/novaserve.git
cd novaserve
pnpm install
pnpm build
pnpm test
```

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE).  
Copyright © 2026 Md Shadab Azam Ansari & NovaServe Contributors.
