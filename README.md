<p align="center">
  <h1 align="center">◆ NovaServe</h1>
  <p align="center">
    <strong>A TypeScript-First Application Compiler for Cloud Infrastructure</strong>
  </p>
  <p align="center">
    Define your application. NovaServe compiles, plans, deploys, and observes your infrastructure.
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/novaserve"><img src="https://img.shields.io/npm/v/novaserve.svg?style=flat-square&color=facc15" alt="npm version" /></a>
    <a href="https://github.com/sazamansari/NovaServe-/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square" alt="node version" /></a>
  </p>
</p>

---

## What is NovaServe?

NovaServe is a **TypeScript application compiler for cloud infrastructure**. Instead of managing cloud-specific YAML files or imperative API scripts, developers declare application logic in TypeScript. NovaServe compiles the application into a provider-neutral, versioned **Nova Intermediate Representation (Nova IR 1.0.0)** graph, computes deterministic DAG topologies, generates fine-grained least-privilege IAM policies, and executes diff-driven cloud deployments.

```text
TypeScript App ──> Nova Compiler ──> Nova IR (1.0.0) ──> Infrastructure Graph ──> Plan / Diff ──> Deployment Engine ──> Providers
```

```typescript
// nova.config.ts — Type-Safe Application Infrastructure
import { defineApp, api, storage, queue, database } from "novaserve";

export default defineApp({
  name: "my-nova-app",
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

    emails: queue.create("emails", {
      handler: "src/handlers/email.process",
      retries: 3,
    }),

    main: database.postgres("main", {
      version: "15",
    }),
  },
});
```

---

## Feature Status Matrix

| Component | Status | Description |
| :--- | :---: | :--- |
| **Nova IR (1.0.0)** | ✅ Stable | Versioned, deterministic, provider-neutral IR schema & canonical SHA256 hashing (`nova ir validate`, `nova ir hash`). |
| **Nova Compiler & DAG Engine** | ✅ Stable | Compiles TypeScript SDK definitions into dependency DAGs with cycle detection. |
| **Least-Privilege IAM Generator** | ✅ Stable | Auto-derives exact resource-scoped IAM statements (`s3:PutObject` on `arn:aws:s3:::uploads/*`). |
| **Capability Validation Matrix** | ✅ Stable | Checks provider engine capabilities; suggests Neon/Supabase alternatives when unsupported. |
| **Planner & Plan Serialization** | ✅ Stable | Diff-driven execution plans, monthly cost estimates, and plan file saving (`nova plan --save plan.json`). |
| **Concurrent State Lock Manager** | ✅ Stable | Process file locking preventing concurrent state corruption (`nova state verify`). |
| **Deployment Journal & Retries** | ✅ Stable | Step-by-step journal (`PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `UNKNOWN`) for idempotent retries. |
| **OpenTelemetry Telemetry Engine** | ✅ Stable | OpenTelemetry span context tracer & waterfall viewer (`nova trace <trace-id>`). |
| **AWS Live State Inspector** | 🧪 Experimental | Live Cloud SDK reader inspecting Lambda, S3, SQS, API Gateway v2, & IAM states (`AWSLiveStateInspector`). |
| **Drift Engine v2 & Safe Remediation** | ✅ Stable | Detects live vs expected configuration drift (`nova drift`, `nova drift --fix`). |
| **Environment Promotion** | ✅ Stable | Promotes IR graph topologies across `staging` → `production` (`nova promote staging production`). |
| **Ephemeral Preview Environments** | ✅ Stable | Deploys isolated preview URL environments (`nova deploy --preview`). |
| **Capability-Gated Plugin System** | ✅ Stable | Plugin architecture with explicit capabilities (`add-resource`, `read-ir`, `transform-ir`). |
| **Docker / Local Provider** | ✅ Stable | Local developer emulator powered by Hono with hot reload. |
| **Cloudflare Provider** | 🧪 Experimental | Target adapter for Cloudflare Workers, R2, and KV. |
| **GCP / Azure / Kubernetes** | 📋 Planned | Planned target adapters for future milestones. |

---

## Installation & CLI Usage

```bash
# 1. Install CLI globally
pnpm add -g novaserve

# 2. Inspect & validate Nova IR
nova ir validate
nova ir hash

# 3. Generate deployment plan & cost estimate
nova plan --save plan.json

# 4. View dependency DAG & least-privilege IAM graph
nova graph

# 5. Check live infrastructure drift
nova drift

# 6. Audit infrastructure security
nova security

# 7. Run AI performance diagnosis
nova ai diagnose

# 8. View OpenTelemetry trace waterfall
nova trace
```

---

## License

MIT © NovaServe Authors
