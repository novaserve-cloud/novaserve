<p align="center">
  <a href="https://github.com/novaserve-cloud/novaserve">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/novaserve-cloud/novaserve/main/docs/assets/logo-dark.svg" width="420" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/novaserve-cloud/novaserve/main/docs/assets/logo.svg" width="420" />
      <img src="https://raw.githubusercontent.com/novaserve-cloud/novaserve/main/docs/assets/logo.svg" width="420" height="80" alt="NovaServe — TypeScript-native serverless framework" />
    </picture>
  </a>
</p>

<br />

<h3 align="center">Build, compile, and deploy serverless applications across cloud and local environments with one TypeScript-native framework.</h3>

<p align="center">
  NovaServe is a compiler-driven infrastructure platform that lets you define cloud resources<br />
  in TypeScript, develop locally with a built-in emulator, and deploy to AWS, Azure, GCP,<br />
  Kubernetes, Cloudflare, or Docker — through a single CLI.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/v/novaserve.svg?style=flat-square&color=6366f1" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/dm/novaserve.svg?style=flat-square&color=38bdf8" alt="npm downloads" /></a>
  <a href="https://github.com/novaserve-cloud/novaserve/stargazers"><img src="https://img.shields.io/github/stars/novaserve-cloud/novaserve?style=flat-square&color=fbbf24" alt="GitHub stars" /></a>
  <a href="https://github.com/novaserve-cloud/novaserve/network/members"><img src="https://img.shields.io/github/forks/novaserve-cloud/novaserve?style=flat-square&color=a78bfa" alt="GitHub forks" /></a>
  <a href="https://github.com/novaserve-cloud/novaserve/issues"><img src="https://img.shields.io/github/issues/novaserve-cloud/novaserve?style=flat-square&color=f87171" alt="GitHub issues" /></a>
  <a href="https://github.com/novaserve-cloud/novaserve/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square" alt="license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square" alt="node version" /></a>
  <a href="https://typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.7+-3178c6.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://github.com/novaserve-cloud/novaserve/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/novaserve-cloud/novaserve/ci.yml?style=flat-square&label=CI" alt="CI status" /></a>
  <a href="https://github.com/novaserve-cloud/novaserve/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/novaserve-cloud/novaserve/release.yml?style=flat-square&label=Release" alt="Release status" /></a>
</p>

---

## Installation

```bash
# Install globally
npm install -g novaserve

# Or use pnpm
pnpm add -g novaserve
```

After installation, the `nova` command is available globally:

```bash
nova --version
```

---

## Quick Start

**1. Create a new project**

```bash
nova init my-app --template basic-api
cd my-app
npm install
```

**2. Start local development**

```bash
nova dev
```

This starts an in-process [Hono](https://hono.dev) server at `http://localhost:3000` with hot reloading. Your API routes, queues, storage, and cron jobs are emulated locally — no cloud account required.

**3. Write a handler**

```typescript
// src/handlers/hello.ts
import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({
    message: "Hello from NovaServe!",
    method: ctx.method,
    path: ctx.path,
  });
};
```

**4. Deploy to cloud**

```bash
# Preview changes
nova plan

# Deploy
nova deploy
```

---

## What is NovaServe?

NovaServe is a TypeScript-native Infrastructure-as-Code (IaC) and serverless development platform built around a compiler-driven deployment architecture. Instead of writing YAML manifests or provider-specific configuration files, you define your entire application — routes, functions, databases, queues, storage, cron jobs, and secrets — as TypeScript.

At its core is a multi-stage compilation pipeline:

```text
TypeScript App Definition  →  Nova Compiler & DAG Engine  →  Nova IR (1.0.0)  →  Diff Planner  →  Provider Adapter  →  Cloud
```

The compiler evaluates your `nova.config.ts`, resolves the resource dependency graph, performs cycle detection and type checking, and emits a canonical **Nova Intermediate Representation (Nova IR 1.0.0)** — a provider-neutral JSON graph with SHA-256 integrity hashing for deterministic deployments.

### Key Principles

- **TypeScript-first**: Infrastructure and runtime code share the same type system. Misconfigurations are caught at compile time.
- **Compiler-driven**: A deterministic compilation pipeline produces reproducible IR graphs — no hidden state mutations.
- **Provider-independent**: Write once, deploy to any supported provider. Application code remains unchanged across targets.
- **Local-first**: Develop and test complete application stacks offline using the built-in Hono emulator.
- **Security by default**: Least-privilege IAM policies are auto-generated from the resource dependency graph.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                       nova.config.ts                            │
│              TypeScript Application Definition                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NovaServe SDK                              │
│        defineApp · api · storage · queue · database · cron      │
│                 fn · cache · secret · env · link                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Nova Compiler & DAG Engine                       │
│     Config parsing · Dependency graph resolution · Cycle         │
│     detection · Schema validation · esbuild bundling             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Nova Intermediate Representation (IR 1.0.0)        │
│        Provider-neutral JSON graph · SHA-256 integrity hash     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Diff Planner & Cost Engine                      │
│    Create / Update / Replace / Delete diffs · Cost estimation    │
│              Least-privilege IAM policy generation               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Journaled Deployment Engine                      │
│    Atomic state transitions · Append-only journal · Rollback    │
│                     Process-level locking                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Local   │ │   AWS    │ │  Azure   │ │   GCP    │ │Cloudflare│ │  Docker  │ │Kubernetes│
│ Emulator │ │          │ │          │ │          │ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Pipeline Stages

| Stage | Package | Description |
|---|---|---|
| **SDK** | `novaserve-sdk` | Type-safe resource builders: `api`, `storage`, `queue`, `database`, `cron`, `cache`, `secret`, `fn` |
| **Compiler** | `novaserve-core` | Evaluates `nova.config.ts`, resolves dependency DAG, enforces schema constraints |
| **IR** | `novaserve-core` | Emits Nova IR 1.0.0 — a provider-neutral JSON graph with SHA-256 integrity hash |
| **Planner** | `novaserve-core` | Computes resource diffs and estimated monthly costs against existing state |
| **Deployer** | `novaserve-core` | Journaled, atomic deployment engine with process locking and rollback support |
| **Providers** | `novaserve-provider-*` | Translate Nova IR into provider-specific API calls |

---

## Core Concepts

### Resource Builders

NovaServe provides type-safe builder functions for declaring infrastructure:

| Builder | Description | Example |
|---|---|---|
| `api.create()` | HTTP API Gateway with route mapping | `api.create({ routes: { "GET /": "src/index.handler" } })` |
| `fn()` | Standalone serverless function | `fn("process", { handler: "src/process.handler" })` |
| `storage.bucket()` | Object storage bucket | `storage.bucket("uploads", { maxSize: "10mb" })` |
| `database.postgres()` | Managed PostgreSQL database | `database.postgres("main-db", { version: "15" })` |
| `queue.create()` | Background message queue | `queue.create("jobs", { handler: "src/worker.process" })` |
| `cron.schedule()` | Scheduled task (cron expression) | `cron.schedule("0 0 * * *", { handler: "src/cleanup.run" })` |
| `cache.create()` | Managed cache (Redis-compatible) | `cache.create("session-cache")` |
| `secret.define()` | Encrypted environment secret | `secret.define("API_KEY")` |

### Nova IR & Hashing

The intermediate representation decouples application logic from cloud vendor APIs. Each compiled IR artifact produces a deterministic SHA-256 hash, enabling fast change detection, incremental deployments, and deployment idempotency.

### Least-Privilege IAM

The compiler inspects cross-resource references (e.g., an API route handler accessing an S3 bucket) and automatically generates exact, minimal IAM policy statements — scoped to the specific resource ARN rather than using wildcards.

### Journaled State

Deployments write to a journal file (`.nova/journal.json`) with process-level locking. This prevents concurrent state corruption across CI/CD pipelines and supports deterministic rollbacks.

---

## Configuration

NovaServe uses `nova.config.ts` — a TypeScript configuration file in your project root.

```typescript
// nova.config.ts
import { defineApp, api, storage, queue, database, cron, secret } from "novaserve";

export default defineApp({
  // ── Required ──────────────────────────────
  name: "my-nova-app",

  // ── Optional (defaults shown) ─────────────
  region: "us-east-1",          // Deployment region
  runtime: "node20",            // Function runtime
  memory: 256,                  // Default memory (MB)
  timeout: 30,                  // Default timeout (seconds)
  provider: "aws",              // Target provider

  // ── Resources ─────────────────────────────
  resources: {
    // HTTP API with route mapping
    api: api.create({
      routes: {
        "GET /health": "src/handlers/health.get",
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
        "GET /users/:id": "src/handlers/users.getById",
      },
      cors: {
        origins: ["https://app.example.com"],
      },
    }),

    // Object storage
    uploads: storage.bucket("user-uploads", {
      maxSize: "10mb",
    }),

    // Background job queue
    emailQueue: queue.create("email-notifications", {
      handler: "src/handlers/email.process",
      retries: 3,
    }),

    // Managed PostgreSQL
    mainDb: database.postgres("main-db", {
      version: "15",
    }),

    // Scheduled task
    cleanupTask: cron.schedule("0 0 * * *", {
      handler: "src/handlers/cleanup.run",
    }),

    // Encrypted secret
    stripeKey: secret.define("STRIPE_SECRET_KEY"),
  },

  // ── Environment Overrides ─────────────────
  environments: {
    production: { region: "us-east-1" },
    staging: { region: "ap-south-1" },
  },

  // ── Resource Tags ─────────────────────────
  tags: {
    project: "my-nova-app",
    team: "engineering",
  },
});
```

### Supported Runtimes

`node18` · `node20` · `node22` · `python3.11` · `python3.12` · `python3.13` · `go1.21` · `go1.22` · `java17` · `java21` · `dotnet8` · `rust` · `bun`

### Supported Providers

`aws` · `azure` · `gcp` · `cloudflare` · `docker` · `kubernetes` · `local`

---

## Provider Support Matrix

NovaServe uses a pluggable provider adapter model. Each adapter translates the Nova IR graph into native cloud API calls with lifecycle management.

| Provider | Status | Supported Services |
|---|:---:|---|
| **Local Emulator** | Production | HTTP API (Hono), In-memory Queue, Local Storage, Process Runner, Hot Reload |
| **AWS** | Production | API Gateway v2, Lambda, S3, SQS, DynamoDB, IAM, CloudWatch Logs |
| **Azure** | Production | Azure Functions, Blob Storage, Service Bus, Cosmos DB, API Management, Key Vault, Redis Cache, Event Grid, Managed Identity, Azure Monitor |
| **GCP** | Production | Cloud Functions, Cloud Storage, Pub/Sub, Cloud Scheduler, Cloud SQL, Memorystore, API Gateway, Secret Manager, IAM |
| **Kubernetes** | Production | Deployment, Service, Ingress, StatefulSet, CronJob, PVC, Secret, ConfigMap, NetworkPolicy |
| **Cloudflare** | Experimental | Workers, R2 Buckets, D1 Database, Queues, KV Secrets |
| **Docker** | Experimental | Dockerfile generation, Docker Compose, Registry push, Health checks, Security hardening, Resource limits |

> **Status definitions**:
> - **Production** — Feature-complete with tests. Suitable for production workloads.
> - **Experimental** — Functional but under active development. API surface may change.

---

## Local Development

NovaServe's local emulator lets you develop and test your entire application stack without provisioning cloud infrastructure or requiring cloud credentials.

```bash
nova dev
```

This starts a [Hono](https://hono.dev)-powered HTTP server at `http://localhost:3000` with:

- **Hot reloading** via [chokidar](https://github.com/paulmillr/chokidar) — code changes are picked up automatically
- **API Gateway emulation** — your route definitions work exactly as they would in production
- **Lambda-compatible context** — handlers receive the same `NovaContext` interface
- **In-memory queue processing** — background jobs execute locally
- **Local storage** — file operations use the local filesystem

```bash
# Specify a custom port
nova dev --port 4000
```

---

## CLI Reference

Usage: `nova [command] [options]`

| Command | Description |
|---|---|
| `nova init [name]` | Scaffold a new NovaServe project from a template |
| `nova dev` | Start local Hono development server with hot reload |
| `nova build` | Compile handlers with esbuild and generate Nova IR |
| `nova plan` | Generate execution diff and cost estimation |
| `nova deploy` | Deploy compiled IR graph to target cloud provider |
| `nova destroy` | Safely tear down deployed infrastructure |
| `nova diff` | Display granular resource attribute changes |
| `nova drift` | Detect live infrastructure drift and auto-remediate (`--fix`) |
| `nova ir` | Inspect, validate, and hash Nova IR 1.0.0 artifacts |
| `nova graph` | Visualize dependency DAG and IAM graph in terminal |
| `nova impact` | Blast-radius impact analysis for a resource |
| `nova state` | Inspect deployment state graph and lock status |
| `nova rollback` | Roll back to a previous deployment journal state |
| `nova deployment` | Inspect deployment history and resume paused journals |
| `nova promote` | Promote IR graph across environments (e.g., staging → production) |
| `nova invoke` | Invoke a deployed function directly |
| `nova logs` | Stream real-time function log output |
| `nova trace` | Inspect OpenTelemetry distributed trace waterfalls |
| `nova events` | Inspect event payloads and trigger local event replays |
| `nova cost` | Infrastructure cost intelligence and optimization |
| `nova security` | Audit IAM policies, public storage, and security posture |
| `nova doctor` | Verify Node.js, CLI, and provider credential health |
| `nova ai` | AI-powered infrastructure diagnostics |
| `nova add` | Install a plugin from the NovaServe marketplace |
| `nova plugins` | List installed plugins |
| `nova dashboard` | Launch local visual management console |

---

## Deployment

### Workflow

```text
nova.config.ts
      │
      ▼
  nova build          Compile handlers (esbuild) + generate Nova IR
      │
      ▼
  nova plan           Diff against deployed state + cost estimation
      │
      ▼
  nova deploy         Journaled execution via provider adapter
      │
      ▼
  Cloud Infrastructure    Running application
```

### Environment Configuration

Deploy to specific environments with provider and region overrides:

```bash
# Deploy to staging
nova deploy --env staging

# Deploy to a specific provider
nova deploy --provider azure

# Dry run (preview only)
nova deploy --dry-run
```

### Provider Credentials

NovaServe uses standard provider credential chains:

| Provider | Credential Source |
|---|---|
| **AWS** | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, `~/.aws/credentials`, IAM instance roles |
| **Azure** | `@azure/identity` DefaultAzureCredential (managed identity, CLI, environment) |
| **GCP** | `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, gcloud CLI auth |
| **Kubernetes** | `~/.kube/config`, `KUBECONFIG`, in-cluster credentials |
| **Cloudflare** | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

---

## Docker

> **Status: Experimental** — Functional for local and on-premise containerization. API surface may change.

NovaServe's Docker provider generates production-ready Dockerfiles and Docker Compose configurations from your `nova.config.ts`.

```typescript
export default defineApp({
  name: "my-app",
  provider: "docker",
  docker: {
    registry: {
      url: "ghcr.io",
      repository: "my-org/my-app",
      tagStrategy: "git-commit",
      push: true,
    },
    resources: {
      limits: { cpus: "1.0", memory: "512m" },
    },
    security: {
      nonRoot: true,
      readOnlyRootFilesystem: true,
      dropCapabilities: true,
      noNewPrivileges: true,
    },
    healthCheck: {
      type: "http",
      endpoint: "/health",
      interval: 30,
      retries: 3,
    },
    compose: true,
  },
  resources: { /* ... */ },
});
```

```bash
# Build and deploy with Docker
nova deploy --provider docker
```

The Docker provider generates:
- **Dockerfile** with multi-stage builds, security hardening, and health checks
- **Docker Compose** configuration with networking, volumes, and service dependencies
- **`.dockerignore`** for optimized build context
- **Environment variable** injection from Nova IR

---

## Kubernetes

> **Status: Production** — Generates and applies standard Kubernetes manifests.

NovaServe's Kubernetes provider maps your resource definitions to native Kubernetes objects:

| NovaServe Resource | Kubernetes Object |
|---|---|
| `api.create()` | Deployment + Service + Ingress |
| `fn()` | Deployment + Service |
| `queue.create()` | Deployment (worker) |
| `cron.schedule()` | CronJob |
| `storage.bucket()` | PersistentVolumeClaim |
| `database.postgres()` | StatefulSet + Service + PVC |
| `secret.define()` | Secret |

```typescript
export default defineApp({
  name: "my-app",
  provider: "kubernetes",
  kubernetes: {
    namespace: "production",
    context: "my-cluster",
    apply: true,
    ingressClassName: "nginx",
    waitForRollout: true,
    rolloutTimeoutSeconds: 300,
  },
  resources: { /* ... */ },
});
```

---

## Multi-Cloud Architecture

NovaServe separates application definitions from infrastructure providers. Your `nova.config.ts` resources remain the same — only the `provider` field changes:

```typescript
// The same application definition works across providers
export default defineApp({
  name: "my-app",
  provider: "aws",       // Change to "azure", "gcp", "docker", "kubernetes"
  resources: {
    api: api.create({
      routes: { "GET /health": "src/health.handler" },
    }),
    uploads: storage.bucket("uploads"),
    jobs: queue.create("background-jobs", {
      handler: "src/worker.process",
    }),
  },
});
```

**What is portable:**
- Resource definitions (`api`, `storage`, `queue`, `cron`, `secret`, `fn`)
- Handler code and business logic
- Environment variable structure

**What remains provider-specific:**
- Provider credentials and authentication
- Region identifiers
- Provider-specific configuration blocks (`docker: {}`, `kubernetes: {}`)
- Advanced provider features (e.g., DynamoDB-specific settings, Azure Event Grid)

---

## Environment Variables & Secrets

### Development

Use the `env` helper and `secret.define()` in your configuration:

```typescript
import { defineApp, secret, env } from "novaserve";

export default defineApp({
  name: "my-app",
  resources: {
    dbUrl: secret.define("DATABASE_URL"),
    apiKey: secret.define("API_KEY"),
  },
  environments: {
    development: {
      variables: {
        LOG_LEVEL: "debug",
      },
    },
    production: {
      variables: {
        LOG_LEVEL: "error",
      },
    },
  },
});
```

### Production

- **AWS**: Secrets are managed via IAM with auto-scoped access policies
- **Azure**: Key Vault integration with Managed Identity RBAC
- **GCP**: Secret Manager with IAM bindings
- **Kubernetes**: Native Kubernetes Secrets
- **Local**: Environment variables loaded from process environment

Secrets are never logged, included in plan output, or stored in the Nova IR graph.

---

## Example Application

### Project Structure

```text
my-api/
├── nova.config.ts          # Infrastructure configuration
├── package.json
├── tsconfig.json
└── src/
    └── handlers/
        ├── health.ts       # GET /health
        ├── users.ts        # GET/POST /users
        └── email.ts        # Queue processor
```

### Handler Example

```typescript
// src/handlers/users.ts
import type { NovaContext } from "novaserve/runtime";

export const list = async (ctx: NovaContext) => {
  return ctx.json({ users: [] });
};

export const create = async (ctx: NovaContext) => {
  const body = await ctx.req.json();
  return ctx.json({ created: true, user: body }, 201);
};
```

### Request Flow

```text
HTTP Request
    │
    ▼
nova dev (Local Hono Server)           — or —           API Gateway (AWS/Azure/GCP)
    │                                                        │
    ▼                                                        ▼
Route Matching ("GET /users" → users.list)
    │
    ▼
Handler Execution (NovaContext)
    │
    ▼
Response
```

---

## Infrastructure Lifecycle

```text
  1. INIT ────────► 2. DEV ────────► 3. BUILD ────────► 4. PLAN
  Scaffold Project   Local Emulator   Typecheck & DAG    Diff & Cost
                                                              │
  8. DESTROY ◄───── 7. TRACE ◄────── 6. DEPLOY ◄──────── 5. APPLY
  Teardown State     Observability    Journaled Execution  Confirm
```

---

## Project Structure

NovaServe is maintained as a modular TypeScript monorepo:

```text
novaserve/
├── packages/
│   ├── cli/               # Global 'nova' CLI (published as 'novaserve' on npm)
│   ├── core/              # Compiler, DAG engine, IR validator, planner, deployer, journal
│   ├── sdk/               # Developer API (defineApp, api, storage, queue, etc.)
│   ├── runtime/           # Universal handler wrapper & NovaContext
│   ├── auth/              # Authentication & security utilities
│   └── providers/
│       ├── local/         # In-process Hono development emulator
│       ├── aws/           # AWS Lambda, API Gateway, S3, SQS, DynamoDB, IAM
│       ├── azure/         # Azure Functions, Blob, Service Bus, Cosmos DB, Key Vault
│       ├── gcp/           # Cloud Functions, Storage, Pub/Sub, Scheduler, SQL
│       ├── cloudflare/    # Workers, R2, D1, Queues (Experimental)
│       ├── docker/        # Dockerfile & Compose generation (Experimental)
│       └── kubernetes/    # Manifest generation & kubectl apply
├── apps/
│   └── dashboard/         # Local visual control dashboard (Vite + React)
├── docs/                  # Documentation & assets
├── turbo.json             # Turborepo pipeline configuration
├── pnpm-workspace.yaml    # Workspace definition
├── SECURITY.md            # Security policy
├── LICENSE                # Apache 2.0
└── NOTICE                 # Copyright attribution
```

---

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm 9.15.0+

### Setup

```bash
# Clone repository
git clone https://github.com/novaserve-cloud/novaserve.git
cd novaserve

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Lint
pnpm lint

# Clean build artifacts
pnpm clean
```

### Dev Dependencies

| Tool | Version | Purpose |
|---|---|---|
| TypeScript | ^5.7.0 | Type system & compiler |
| Vitest | ^3.0.0 | Unit & integration testing |
| Turborepo | ^2.4.0 | Monorepo build orchestration |
| esbuild | ^0.24.0 | Function handler bundling |
| Prettier | ^3.4.0 | Code formatting |

---

## Testing

NovaServe uses [Vitest](https://vitest.dev) across all packages:

```bash
# Run all tests
pnpm test

# Run tests for a specific package
cd packages/core && pnpm test
cd packages/providers/aws && pnpm test
cd packages/providers/azure && pnpm test
cd packages/providers/gcp && pnpm test
cd packages/providers/docker && pnpm test
cd packages/providers/cloudflare && pnpm test

# Type checking (all packages)
pnpm typecheck
```

Tests are located alongside source files (e.g., `provider.test.ts`) and in dedicated `tests/` directories where applicable.

---

## CI/CD

NovaServe uses GitHub Actions for continuous integration and release automation.

### CI Pipeline (`ci.yml`)

```text
Push / Pull Request (main, develop)
         │
         ▼
   ┌───────────┐
   │ Checkout   │
   └─────┬─────┘
         │
    ┌────┴─────┐
    ▼          ▼
Node 20.x   Node 22.x      ◄── Matrix build
    │          │
    ▼          ▼
  Install (pnpm --frozen-lockfile)
    │
    ▼
  Build → Typecheck → Test
    │
    ▼
  Security Audit (pnpm audit)
    │
    ▼
  Package Integrity Check (npm pack --dry-run)
```

- **Workflow**: [`.github/workflows/ci.yml`](https://github.com/novaserve-cloud/novaserve/blob/main/.github/workflows/ci.yml)
- **Concurrency**: Duplicate runs are automatically cancelled
- **Matrix**: Tests against Node.js 20.x and 22.x

### Release Pipeline (`release.yml`)

```text
GitHub Release Published / Manual Dispatch
         │
         ▼
  Build all packages
         │
         ▼
  pnpm publish --provenance --access public
```

- **Workflow**: [`.github/workflows/release.yml`](https://github.com/novaserve-cloud/novaserve/blob/main/.github/workflows/release.yml)
- **Trigger**: GitHub Release creation or manual workflow dispatch
- **Provenance**: Configured with `--provenance` flag and `id-token: write` permissions

---

## npm Provenance

NovaServe's release workflow is configured to publish with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) via Sigstore, providing verifiable information about where the package was built and published.

### Release Workflow Configuration

The [`release.yml`](https://github.com/novaserve-cloud/novaserve/blob/main/.github/workflows/release.yml) workflow includes:

```yaml
permissions:
  contents: read
  id-token: write  # Required for npm provenance / Sigstore

# ...

- name: Publish to NPM
  run: pnpm publish --provenance --no-git-checks --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Current Status

The release workflow has the correct provenance configuration:
- `id-token: write` permission is set
- The `--provenance` flag is passed to `pnpm publish`

> **Note**: As of the latest published version (`2.1.17`), provenance metadata is not yet present on the npm registry. This typically requires that the publish step run from a GitHub Actions environment with OIDC token support enabled and that the npm registry accepts the Sigstore attestation. If provenance is not appearing, verify:
> 1. The workflow runs on GitHub Actions (not a local machine)
> 2. The npm token has publish permissions
> 3. The npm registry version supports provenance attestations
> 4. `pnpm` is configured to pass provenance through to `npm publish` correctly

Once provenance is active, each published version will include:

| Field | Value |
|---|---|
| **Build environment** | GitHub Actions |
| **Source repository** | `github.com/novaserve-cloud/novaserve` |
| **Build file** | `.github/workflows/release.yml` |
| **Transparency log** | Sigstore Rekor public ledger |

---

## Security

NovaServe is committed to secure infrastructure deployment practices.

### Security Design

- **Least-privilege IAM**: The compiler auto-generates minimal IAM policies from the dependency graph
- **Secret scanning**: `nova security` audits IR graphs for hardcoded secrets and wildcard policies
- **Production protection**: Destructive actions on production environments are blocked by default
- **Atomic state**: Deployment state uses atomic file operations to prevent corruption
- **No credential logging**: Secrets and credentials are masked in all logs and plan output
- **Dependency auditing**: `pnpm audit` runs as part of CI

### Vulnerability Reporting

**Do not open public GitHub issues for security vulnerabilities.**

Please use [GitHub's private vulnerability reporting](https://github.com/novaserve-cloud/novaserve/security/advisories) or review our [SECURITY.md](https://github.com/novaserve-cloud/novaserve/blob/main/SECURITY.md) for the full reporting process.

### Response Timeline

| Stage | Timeframe |
|---|---|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 7 days |
| Fix (critical) | Within 30 days |
| Fix (high/medium) | Within 90 days |

### Supported Versions

| Version | Status |
|---|---|
| 2.x | Active support |
| 1.x | End of life |

---

## Roadmap

### Implemented

- [x] Nova IR 1.0.0 — Versioned, canonical JSON IR schema and validation
- [x] AWS Provider (Production) — Lambda, API Gateway, S3, SQS, DynamoDB, IAM
- [x] Azure Provider (Production) — Functions, Blob, Service Bus, Cosmos DB, Key Vault, Redis, Event Grid, APIM, Monitor
- [x] GCP Provider (Production) — Cloud Functions, Storage, Pub/Sub, Scheduler, SQL, Memorystore, Secret Manager
- [x] Kubernetes Provider (Production) — Manifest generation + kubectl apply
- [x] Local Emulator (Production) — In-process Hono server with hot reload
- [x] Least-Privilege IAM Generator — Automatic scoped policy derivation
- [x] Drift Detection & Remediation — `nova drift --fix`
- [x] Docker Provider (Experimental) — Dockerfile, Compose, registry push, health checks

### In Progress

- [ ] Cloudflare & Edge Provider Maturation — Full production readiness for Workers, R2, D1
- [ ] Kubernetes CRD — Native Nova IR operator for Kubernetes clusters

### Planned

- [ ] Plugin ecosystem & marketplace
- [ ] Advanced observability (distributed tracing dashboards)
- [ ] More event sources and triggers
- [ ] Improved multi-region deployment
- [ ] Cost optimization recommendations engine

> Features marked **Planned** are under consideration and are not currently implemented. Do not rely on them for production decisions.

---

## Comparison

| Capability | NovaServe | Serverless Framework |
|---|:---:|:---:|
| **Configuration Language** | TypeScript | YAML |
| **Local Development** | Built-in (Hono emulator) | Plugin-dependent |
| **AWS Support** | Production | Production |
| **Azure Support** | Production | Community plugins |
| **GCP Support** | Production | Community plugins |
| **Kubernetes** | Production | Not supported |
| **Docker/On-prem** | Experimental | Not supported |
| **Cloudflare** | Experimental | Community plugins |
| **IAM Generation** | Automatic (least-privilege) | Manual |
| **Drift Detection** | Built-in | Not supported |
| **Infrastructure Paradigm** | Compiler + IR | Template generator |
| **Type Safety** | Full (TypeScript native) | None (YAML) |
| **Cost Estimation** | Built-in | Not built-in |
| **Deployment Model** | Journaled (atomic, rollback) | Direct API calls |

> This comparison reflects publicly available documentation. Feature availability may differ across versions.

---

## Why NovaServe?

- **One language for everything.** Your application code, infrastructure, and deployment logic are all TypeScript. No context-switching between YAML, HCL, and application code.

- **Develop offline, deploy anywhere.** The built-in local emulator faithfully reproduces your cloud stack — no internet connection or cloud credentials required during development.

- **Compiler-verified deployments.** The Nova Compiler catches dependency cycles, missing bindings, and type mismatches before any cloud API is called.

- **Security without manual work.** Least-privilege IAM policies are derived from the resource graph automatically. No hand-writing policy documents.

- **Provider flexibility.** Switch between AWS, Azure, GCP, Kubernetes, or Docker by changing a single configuration field. Your business logic stays untouched.

- **Deterministic and auditable.** SHA-256 hashed IR graphs, journaled deployments, and process-level locking ensure that deployments are reproducible and recoverable.

---

## Community

- **GitHub Repository**: [novaserve-cloud/novaserve](https://github.com/novaserve-cloud/novaserve)
- **Issues**: [GitHub Issues](https://github.com/novaserve-cloud/novaserve/issues)
- **npm Package**: [novaserve](https://www.npmjs.com/package/novaserve)
- **Homepage**: [novaserve.cloud](https://www.novaserve.cloud/)
- **Releases**: [GitHub Releases](https://github.com/novaserve-cloud/novaserve/releases)

---

## Contributing

Contributions are welcome. To get started:

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/<your-username>/novaserve.git
cd novaserve

# 3. Install dependencies
pnpm install

# 4. Create a feature branch
git checkout -b feature/my-change

# 5. Make your changes, then build and test
pnpm build
pnpm test
pnpm typecheck

# 6. Open a Pull Request
```

Please ensure:
- All tests pass (`pnpm test`)
- Type checking passes (`pnpm typecheck`)
- Code is formatted (`prettier`)
- Commit messages are clear and descriptive

---

## License

Licensed under the **Apache License, Version 2.0**.

Copyright 2026 Md Shadab Azam Ansari & NovaServe Contributors.

See [LICENSE](https://github.com/novaserve-cloud/novaserve/blob/main/LICENSE) and [NOTICE](https://github.com/novaserve-cloud/novaserve/blob/main/NOTICE) for details.
