<p align="center">
  <img src="https://raw.githubusercontent.com/sazamansari/NovaServe-/main/docs/assets/logo.svg" height="80" alt="NovaServe Logo" />
</p>

# novaserve-sdk

> TypeScript-first serverless application configuration SDK for **NovaServe**.

Define cloud resources—APIs, databases, object storage, queues, cron jobs, and secrets—directly in TypeScript with 100% type safety and zero YAML boilerplate.

## Installation

```bash
npm install novaserve-sdk
# or
pnpm add novaserve-sdk
```

## Quick Example (`nova.config.ts`)

```typescript
import { defineApp, api, storage, queue, database } from "novaserve";

export default defineApp({
  name: "my-nova-app",
  region: "ap-south-1",
  runtime: "node20",

  resources: {
    api: api.create({
      routes: {
        "GET /health": "src/handlers/health.get",
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
      },
      cors: true,
    }),

    uploads: storage.bucket("user-uploads", { maxSize: "10mb" }),

    emailQueue: queue.create("email-notifications", {
      handler: "src/handlers/email.process",
      retries: 3,
    }),

    mainDb: database.postgres("main-db", { version: "15" }),
  },
});
```

## API Exports

- `defineApp(config)`: Primary application specification builder
- `api.create(options)`: HTTP API Gateway and route mappings
- `fn.create(options)`: Standalone serverless function definition
- `storage.bucket(name, options)`: S3 / R2 Object storage bucket
- `database.postgres(name, options)`: Managed relational PostgreSQL database
- `queue.create(name, options)`: Asynchronous SQS message queue worker
- `cron.schedule(cronExpr, options)`: Scheduled cron job worker
- `cache.redis(name, options)`: Managed ElastiCache / Redis in-memory store
- `secret.define(name)`: KMS encrypted secret reference

## Documentation & Repository

- **Main Repository**: [https://github.com/sazamansari/NovaServe-](https://github.com/sazamansari/NovaServe-)
- **Primary Package**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

## License

Apache-2.0 © Md Shadab Azam Ansari & NovaServe Contributors
