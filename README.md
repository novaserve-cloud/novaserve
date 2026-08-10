<p align="center">
  <img src="https://raw.githubusercontent.com/sazamansari/NovaServe-/main/docs/assets/icon.svg" width="72" alt="NovaServe">
</p>

<h1 align="center">NovaServe</h1>

<p align="center">
  The TypeScript-native Serverless & Infrastructure Platform
</p>

<p align="center">
  Define infrastructure in TypeScript. Compile it into cloud resources. Deploy with confidence.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/v/novaserve.svg?style=flat-square&color=6366f1" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/dm/novaserve.svg?style=flat-square&color=38bdf8" alt="npm downloads" /></a>
  <a href="https://github.com/sazamansari/NovaServe-/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square" alt="node version" /></a>
  <a href="https://github.com/sazamansari/NovaServe-/actions"><img src="https://img.shields.io/badge/CI-passing-success.svg?style=flat-square" alt="CI status" /></a>
</p>

---

```text
ONE SDK  ──►  ONE COMPILER  ──►  ONE IR  ──►  ONE PLANNER  ──►  MULTIPLE CLOUD PROVIDERS
```

---

## Overview

**NovaServe** is a TypeScript-native application compiler and deployment platform for modern cloud infrastructure. Designed to replace complex YAML configurations and imperative scripts with type-safe code, NovaServe enables developers to declare application resources and cloud dependencies in pure TypeScript.

Instead of writing static cloud manifests, NovaServe compiles your application code into a canonical, versioned **Nova Intermediate Representation (Nova IR 1.0.0)**. It computes deterministic DAG topologies, generates least-privilege IAM policies, calculates cost estimates, and executes differential cloud deployments to **AWS**, **Azure**, **GCP**, **Cloudflare**, **Docker**, or your **Local Machine**.

---

## Core Capabilities

- **Zero YAML Configuration**: Define APIs, databases, queues, object storage, and cron workers directly in TypeScript with full autocomplete and compile-time type safety.
- **Deterministic Nova IR (1.0.0)**: Emits canonical, versioned intermediate representation with cryptographic SHA256 integrity verification.
- **Least-Privilege IAM Engine**: Automatically derives exact, resource-scoped IAM roles and policy statements (`s3:PutObject`, `sqs:SendMessage`).
- **Diff-Driven Planner**: Inspect infrastructure changes and estimated monthly cost impact prior to applying (`nova plan`).
- **Drift Engine & Remediation**: Automatically detects live cloud configuration drift vs declared state with safe resolution (`nova drift --fix`).
- **Multi-Cloud Target Adapters**: Deploy to AWS (Lambda/S3/SQS), Cloudflare Workers, Docker containers, or run locally with the built-in Hono emulator.
- **OpenTelemetry Telemetry & AI Copilot**: Native span tracing waterfall viewer (`nova trace`) and AI-powered terminal diagnostic engine (`nova ai`).

---

## Quick Start

### 1. Install CLI

Install the NovaServe CLI globally via `npm` or `pnpm`:

```bash
npm install -g novaserve
# or
pnpm add -g novaserve
```

### 2. Create Application

Scaffold a new NovaServe project using an official template:

```bash
nova init my-app --template basic-api
cd my-app
```

### 3. Develop & Deploy

```bash
# Start local development server with hot reload
nova dev

# Open local visual control dashboard
nova dashboard

# Generate deployment diff & cost plan
nova plan

# Deploy infrastructure to cloud provider
nova deploy
```

---

## Declarative Infrastructure (`nova.config.ts`)

```typescript
import { defineApp, api, storage, queue, database, cron, secret } from "novaserve";

export default defineApp({
  name: "my-nova-app",
  region: "ap-south-1",
  runtime: "node20",

  resources: {
    // HTTP API Gateway & Handler Routing
    api: api.create({
      routes: {
        "GET /health": "src/handlers/health.get",
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
      },
      cors: true,
    }),

    // S3 / R2 Object Storage Bucket
    uploads: storage.bucket("user-uploads", {
      maxSize: "10mb",
    }),

    // Background Asynchronous Message Queue
    emailQueue: queue.create("email-notifications", {
      handler: "src/handlers/email.process",
      retries: 3,
    }),

    // Managed PostgreSQL Database
    mainDb: database.postgres("main-db", {
      version: "15",
    }),

    // Scheduled Cron Job
    dailyReport: cron.schedule("0 0 * * *", {
      handler: "src/handlers/reports.generate",
    }),

    // KMS Encrypted Environment Secret
    stripeKey: secret.define("STRIPE_SECRET_KEY"),
  },
});
```

---

## Architecture Flow

```text
┌─────────────────────────┐
│   TypeScript App Spec   │  (nova.config.ts)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Nova Application DAG  │  (Cycle & Capability Validation)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│     Nova IR (1.0.0)     │  (Canonical SHA256 Hash Integrity)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Diff & Cost Planner   │  (Resource Change Set & Cost Estimation)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Journaled Deployer    │  (Idempotent Locks & Rollback Engine)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│   Multi-Cloud Targets   │  (AWS, Azure, GCP, Cloudflare, Docker, Local)
└────────────┴────────────┘
```

---

## CLI Reference

Usage: `nova [command] [options]`

| Command | Options | Description |
|---|---|---|
| `nova init [name]` | `--template <template>` | Scaffolds a new NovaServe project |
| `nova dev` | `-p, --port <port>` | Launches local Hono emulator with hot reload |
| `nova build` | `-e, --env <env>` | Bundles serverless handlers using esbuild |
| `nova plan` | `--save <file>` | Computes diff-driven deployment plan & cost estimation |
| `nova deploy` | `--provider <provider>` | Executes journaled deployment to cloud provider |
| `nova destroy` | `--force` | Removes all deployed cloud infrastructure |
| `nova drift` | `--fix` | Audits live infrastructure drift & applies remediation |
| `nova security` | — | Audits IAM policy statements and resource exposure |
| `nova dashboard` | `-p, --port <port>` | Opens visual control web interface |
| `nova ai` | `diagnose` | Interactive AI agent terminal diagnostic assistant |
| `nova trace` | `[trace-id]` | Displays OpenTelemetry execution waterfall |
| `nova ir` | `validate`, `hash` | Inspects & hashes Nova Intermediate Representation |
| `nova doctor` | — | Checks system environment & cloud credential health |

---

## SDK API Reference

| Builder Method | Import | Description |
|---|---|---|
| `defineApp(config)` | `import { defineApp } from "novaserve"` | Root application entrypoint configuration |
| `api.create(options)` | `import { api } from "novaserve"` | High-performance HTTP API Gateway |
| `fn.create(options)` | `import { fn } from "novaserve"` | Standalone serverless compute function |
| `storage.bucket(name)` | `import { storage } from "novaserve"` | Object storage bucket (AWS S3 / Cloudflare R2) |
| `database.postgres(name)` | `import { database } from "novaserve"` | Managed relational PostgreSQL instance |
| `queue.create(name)` | `import { queue } from "novaserve"` | Asynchronous message queue worker (SQS) |
| `cron.schedule(cronExpr)` | `import { cron } from "novaserve"` | Scheduled cron job trigger |
| `cache.redis(name)` | `import { cache } from "novaserve"` | Managed ElastiCache / Upstash Redis |
| `secret.define(name)` | `import { secret } from "novaserve"` | KMS-encrypted environment secret manager |

---

## Platform Comparison

| Capability | NovaServe | Serverless Framework | SST (v3) | Terraform / Pulumi |
|---|:---:|:---:|:---:|:---:|
| **Language Paradigm** | **TypeScript** | YAML | TypeScript | HCL / Code |
| **Type Safety** | **Full 100%** | None | Partial | Partial |
| **Local Emulator** | **Instant (Hono)** | Plugin-dependent | Local Dev | No Local |
| **IAM Policy Gen** | **Auto Least-Privilege** | Manual | Partial | Manual |
| **Visual Console** | **Built-in (`nova dashboard`)** | Cloud Service | SST Console | Separate Tooling |
| **Drift Remediation** | **`nova drift --fix`** | No | No | State Refresh Only |
| **Multi-Cloud Adapters** | **AWS / GCP / Azure / CF / Docker** | Multi-Cloud | AWS / Cloudflare | Multi-Cloud |

---

## Maintainer & Community

Designed and created by **[Md Shadab Azam Ansari](https://md-shadab-azam-ansari.vercel.app/)**.

- **Portfolio**: [https://md-shadab-azam-ansari.vercel.app/](https://md-shadab-azam-ansari.vercel.app/)
- **GitHub**: [@sazamansari](https://github.com/sazamansari)
- **NPM Package**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

---

## License

MIT License © Md Shadab Azam Ansari & NovaServe Contributors.
