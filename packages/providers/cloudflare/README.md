<p align="center">
  <img src="https://raw.githubusercontent.com/novaserve-cloud/novaserve/main/docs/assets/logo.png" height="80" alt="NovaServe Logo" />
</p>

# novaserve-provider-cloudflare

> **Production Ready** Cloudflare Workers, R2, D1, and KV deployment provider for **NovaServe**.

Target adapter compiling Nova Intermediate Representation (Nova IR 1.0.0) graphs to Cloudflare edge infrastructure.

## Status: Production Ready 🚀

This provider is fully production-grade and supports:
- **Cloudflare Workers** with integrated esbuild bundling (no Wrangler required)
- **R2 Object Storage**
- **D1 Databases** with safe SQL migrations
- **KV Namespaces**
- **Queues**
- **Environment Isolation** (Staging vs Production resource prefixing)
- **Idempotent Deployments**
- **Secure Secrets Management** (secrets are never stored or logged)
- **Real-time Log Streaming** via Cloudflare Tail
- **Zero-downtime Rollbacks**

## Installation

```bash
npm install novaserve-provider-cloudflare
# or
pnpm add novaserve-provider-cloudflare
```

## Authentication

Set the following environment variables. The API token must have `Edit` permissions for Workers Scripts, KV, R2, and D1, and `Read` for Account Settings.

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# Optional: Only required if using custom domains or specific routes
export CLOUDFLARE_ZONE_ID="your-zone-id"
```

## Configuration

In your `nova.config.ts` or `nova.config.yaml`:

```typescript
export default {
  name: "my-app",
  provider: "cloudflare",
  
  // Provider-specific config
  cloudflare: {
    worker: {
      compatibilityDate: "2024-09-01",
      compatibilityFlags: ["nodejs_compat"]
    },
    
    // Custom domain configuration (requires Zone ID)
    domains: [
      { domain: "api.my-app.com" }
    ],

    // Environment overrides
    environments: {
      production: {
        worker: {
          vars: { LOG_LEVEL: "info" }
        }
      },
      staging: {
        worker: {
          vars: { LOG_LEVEL: "debug" }
        }
      }
    }
  }
}
```

## Supported Resources

| Nova Resource | Cloudflare Equivalent | Notes |
|---------------|-----------------------|-------|
| `api` / `function` / `cron` | Cloudflare Worker | Automatically bundled via esbuild. |
| `storage` | R2 Bucket | |
| `database` | D1 Database | Supports automatic migrations (`.sql` files). |
| `cache` | KV Namespace | Redis eviction semantics are best-effort. |
| `queue` | Cloudflare Queue | |

## Database Migrations

For D1 databases, specify the migrations directory in your resource configuration:

```typescript
// Define D1 Database
const db = new Database("my-db", {
  migrationsDir: "./migrations"
});
```

The provider will automatically track and apply pending `.sql` files in the specified directory. **Note:** Destructive migrations (DROP, TRUNCATE, DELETE) are blocked in production environments to prevent accidental data loss.

## Documentation & Repository

- **Main Repository**: [https://github.com/novaserve-cloud/novaserve](https://github.com/novaserve-cloud/novaserve)
- **Primary Package**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

## License

Apache-2.0 © Md Shadab Azam Ansari & NovaServe Contributors
