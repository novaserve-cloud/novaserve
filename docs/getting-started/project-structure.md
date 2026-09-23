# Project Structure

A typical NovaServe application directory structure:

```text
my-api/
├── nova.config.ts        # Application infrastructure and resource definitions
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript configuration
├── src/
│   └── handlers/         # Function handlers executed by compute runtimes
│       ├── hello.ts
│       └── users.ts
└── .nova/                # Local state and build cache (gitignored)
    ├── journal.json
    └── state.json
```

## `nova.config.ts`

The single source of truth for your infrastructure. Declares endpoints, storage buckets, queues, databases, and cron tasks using type-safe SDK builders.

## `src/handlers/`

Handler files export handler functions typed with `NovaContext`:

```typescript
import type { NovaContext } from "novaserve/runtime";

export const handler = async (ctx: NovaContext) => {
  return ctx.json({ ok: true });
};
```
