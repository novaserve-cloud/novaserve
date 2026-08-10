<p align="center">
  <img src="https://raw.githubusercontent.com/sazamansari/NovaServe-/main/docs/assets/banner.png" alt="NovaServe Logo" width="160" style="border-radius: 12px;" />
  <h1 align="center">◆ NovaServe</h1>
  <p align="center">
    <strong>The Next-Generation TypeScript-First Serverless & Cloud Infrastructure Framework</strong>
  </p>
  <p align="center">
    <i>As simple as Vercel · As powerful as Terraform · As fast as Bun</i>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/v/novaserve.svg?style=flat-square&color=ffb800" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/dm/novaserve.svg?style=flat-square&color=00c853" alt="npm downloads" /></a>
    <a href="https://github.com/sazamansari/NovaServe-/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square" alt="node version" /></a>
    <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg?style=flat-square" alt="TypeScript" /></a>
    <a href="https://github.com/sazamansari/NovaServe-/actions"><img src="https://img.shields.io/badge/build-passing-success.svg?style=flat-square" alt="build status" /></a>
  </p>
</p>

---

## 🚀 Overview

**NovaServe** is a modern, TypeScript-native serverless application compiler and deployment engine. Designed to replace complex YAML manifests and verbose IaC scripts with 100% type-safe TypeScript definitions, NovaServe allows developers to build, test, and deploy multi-cloud infrastructure with zero boilerplate.

With NovaServe, your infrastructure code is your application logic. The **Nova Compiler** parses your TypeScript application graph, emits a deterministic **Nova Intermediate Representation (Nova IR 1.0.0)**, generates least-privilege IAM policies, calculates cost estimates, and executes differential cloud deployments to **AWS**, **Azure**, **GCP**, **Cloudflare**, **Docker**, or your **Local Machine**.

```text
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│   TypeScript App Spec   │ ───► │   Nova Compiler & DAG   │ ───► │  Nova IR Graph (1.0.0) │
│    (nova.config.ts)     │      │   Cycle & Type Check    │      │ (Canonical SHA256 Hash) │
└─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                                                               │
                                                                               ▼
┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│     Cloud Provider      │ ◄─── │  Journaled Deployment   │ ◄─── │   Diff & Cost Planner   │
│ (AWS, GCP, Cloudflare)  │      │  State Lock & Rollback  │      │   (Plan Serialization)  │
└─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

---

## ✨ Features

- **⚡ Zero-YAML, 100% Type-Safe**: Write infrastructure directly in TypeScript with full autocomplete and compile-time validation.
- **🛡️ Least-Privilege IAM Engine**: Auto-generates exact, resource-scoped IAM roles and policy statements (`s3:PutObject`, `sqs:SendMessage`).
- **🎯 Multi-Cloud & Local Emulator**: Deploy seamlessly to **AWS**, **Azure**, **GCP**, **Cloudflare Workers**, **Docker**, or test locally with the built-in **Hono** emulator.
- **📊 Interactive Visual Control Dashboard**: View live routes, trace logs, invoke handlers, and inspect resources via `nova dashboard`.
- **🔍 Infrastructure Drift Engine**: Detect live cloud configuration changes vs declared state with automated remediation (`nova drift --fix`).
- **🔮 Diff-Driven Planner & Cost Estimator**: Inspect exact cloud changes and predicted monthly cost impact before applying (`nova plan`).
- **🤖 Built-In AI Infrastructure Copilot**: Real-time terminal diagnostic assistant for handler errors and deployment failures (`nova ai`).
- **📈 OpenTelemetry Tracing**: Integrated span waterfall visualizer for serverless functions (`nova trace`).

---

## ⚡ Quick Start

### 1. Install Global CLI
Install the NovaServe CLI globally using `npm` or `pnpm`:

```bash
npm install -g novaserve
# or
pnpm add -g novaserve
```

### 2. Initialize Project
Create a new serverless app using a starter template:

```bash
npx novaserve init my-app --template basic-api
cd my-app
```

### 3. Run Locally & Deploy

```bash
# Start local development server with hot reload
nova dev

# Launch local visual dashboard
nova dashboard

# Generate deployment diff & cost plan
nova plan

# Deploy to AWS or Cloud Provider
nova deploy
```

---

## 💻 Code Example (`nova.config.ts`)

```typescript
import { defineApp, api, storage, queue, database, cron, secret } from "novaserve";

export default defineApp({
  name: "my-nova-app",
  region: "ap-south-1",
  runtime: "node20",

  resources: {
    // 🌐 HTTP API Gateway & Route Handlers
    api: api.create({
      routes: {
        "GET /health": "src/handlers/health.get",
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
        "GET /users/:id": "src/handlers/users.getById",
      },
      cors: true,
      auth: "jwt",
    }),

    // 📦 S3 / R2 Object Storage Bucket
    userUploads: storage.bucket("user-uploads", {
      maxSize: "10mb",
      lifecycle: { expirationDays: 30 },
    }),

    // 📬 Background Job Queue with DLQ
    emailQueue: queue.create("email-notifications", {
      handler: "src/handlers/email.process",
      retries: 3,
      visibilityTimeout: 30,
    }),

    // 🐘 Managed PostgreSQL Database
    mainDb: database.postgres("main-db", {
      version: "15",
      allocatedStorage: 20,
    }),

    // ⏰ Scheduled Cron Worker
    nightlyCleanup: cron.schedule("0 0 * * *", {
      handler: "src/handlers/cleanup.run",
    }),

    // 🔐 Encrypted Environment Secret
    stripeKey: secret.define("STRIPE_SECRET_KEY"),
  },
});
```

---

## 🛠️ Command Line Interface (CLI)

Usage: `nova [command] [options]` or `novaserve [command] [options]`

| Command | Options | Description |
|---|---|---|
| `nova init [name]` | `--template <template>` | Scaffolds a new NovaServe project |
| `nova dev` | `-p, --port <port>` | Runs local Hono server with hot reloading |
| `nova build` | `-e, --env <env>` | Compiles TypeScript handlers using esbuild |
| `nova plan` | `--save <file>` | Computes diff-driven deployment plan & cost estimation |
| `nova deploy` | `--provider <provider>` | Executes journaled deployment to cloud provider |
| `nova destroy` | `--force` | Safely tears down deployed cloud resources |
| `nova drift` | `--fix` | Inspects live cloud configuration drift & offers safe remediation |
| `nova security` | — | Audits IAM policy statements and open ports |
| `nova dashboard` | `-p, --port <port>` | Launches visual control web interface |
| `nova ai` | `diagnose` | Interactive AI agent terminal assistant |
| `nova trace` | `[trace-id]` | Displays OpenTelemetry execution waterfall |
| `nova ir` | `validate`, `hash` | Validates & hashes Nova Intermediate Representation |
| `nova doctor` | — | Verifies environment, CLI, Node, and cloud credentials |

---

## 🧩 API Reference

### Resource Builders

| SDK Function | Import | Description |
|---|---|---|
| `defineApp(config)` | `import { defineApp } from "novaserve"` | Root application entrypoint configuration |
| `api.create(options)` | `import { api } from "novaserve"` | High-performance HTTP API Gateway |
| `fn.create(options)` | `import { fn } from "novaserve"` | Standalone serverless compute function |
| `storage.bucket(name)` | `import { storage } from "novaserve"` | Object storage bucket (AWS S3 / Cloudflare R2) |
| `database.postgres(name)` | `import { database } from "novaserve"` | Serverless relational PostgreSQL instance |
| `queue.create(name)` | `import { queue } from "novaserve"` | Asynchronous message queue worker (SQS) |
| `cron.schedule(cronExpr)` | `import { cron } from "novaserve"` | Scheduled cron job trigger |
| `cache.redis(name)` | `import { cache } from "novaserve"` | Managed ElastiCache / Upstash Redis |
| `secret.define(name)` | `import { secret } from "novaserve"` | KMS-encrypted environment secret manager |

---

## ⚡ Framework Comparison

| Feature | NovaServe | Serverless Framework | SST (v3) | Terraform / Pulumi |
|---|:---:|:---:|:---:|:---:|
| **Infrastructure Syntax** | **TypeScript** | YAML | TypeScript | HCL / Code |
| **Type Safety** | 🟢 **100% Full** | 🔴 None | 🟡 Partial | 🟡 Partial |
| **Local Emulator** | 🟢 **Instant (Hono)** | 🟡 Slow Plugin | 🟢 Local Dev | 🔴 No Local |
| **IAM Generation** | 🟢 **Auto Least-Privilege**| 🔴 Manual | 🟡 Partial | 🔴 Manual |
| **Visual Dashboard** | 🟢 **Built-in** | 🟡 Paid Serverless Dashboard | 🟢 SST Console | 🔴 No Built-in UI |
| **Drift Remediation** | 🟢 **`nova drift --fix`**| 🔴 No | 🔴 No | 🟡 Drift detection only |
| **Multi-Cloud Target** | 🟢 **AWS/Azure/GCP/CF** | 🟢 Multi-Cloud | 🔴 AWS / Cloudflare only | 🟢 Multi-Cloud |
| **AI Copilot Built-in** | 🟢 **`nova ai`** | 🔴 No | 🔴 No | 🔴 No |

---

## 👨‍💻 Author & Maintainer

Created and maintained with ❤️ by **[Md Shadab Azam Ansari](https://md-shadab-azam-ansari.vercel.app/)**.

- 🌐 **Website**: [https://md-shadab-azam-ansari.vercel.app/](https://md-shadab-azam-ansari.vercel.app/)
- 🐙 **GitHub**: [@sazamansari](https://github.com/sazamansari)
- 📦 **NPM**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)
- 💼 **LinkedIn**: [Md Shadab Azam Ansari](https://www.linkedin.com/in/mdshadabazamansari/)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
