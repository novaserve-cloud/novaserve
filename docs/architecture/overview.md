# Architecture Overview

NovaServe is engineered as a multi-stage compiler pipeline that separates high-level application declaration from low-level cloud provider mechanics.

## Monorepo Architecture

- `packages/cli`: The global `nova` CLI interface.
- `packages/core`: Compiler, DAG solver, Nova IR schema, diff planner, and deployment engine.
- `packages/sdk`: Developer-facing fluent builders (`defineApp`, `api`, `storage`, `queue`, `database`, `cron`).
- `packages/runtime`: Universal handler execution wrapper and OpenTelemetry context propagation.
- `packages/providers/*`: Target cloud vendor adapters (`aws`, `local`, `cloudflare`, `docker`, `azure`, `gcp`, `kubernetes`).
