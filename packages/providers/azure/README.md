<p align="center">
  <img src="https://raw.githubusercontent.com/sazamansari/NovaServe-/main/docs/assets/logo.svg" height="80" alt="NovaServe Logo" />
</p>

# novaserve-provider-azure

> Full-featured Microsoft Azure deployment provider for **NovaServe**.

Target adapter compiling Nova IR graphs to Azure serverless and managed resources with real Azure SDK operations, Managed Identity RBAC, drift detection, and exponential backoff retry engine.

## Supported Azure Services

| Nova IR Resource | Azure Service | SDK Package |
|---|---|---|
| `function` | Azure Functions (Consumption Plan) | `@azure/arm-appservice` |
| `api` | Azure API Management (APIM) | `@azure/arm-apimanagement` |
| `storage` | Azure Storage Accounts + Blob Containers | `@azure/arm-storage` |
| `queue` | Azure Service Bus Namespaces + Queues | `@azure/arm-servicebus` |
| `database` | Azure Cosmos DB (SQL API) | `@azure/arm-cosmosdb` |
| `secret` | Azure Key Vault + Secrets | `@azure/arm-keyvault`, `@azure/keyvault-secrets` |
| `cache` | Azure Cache for Redis | `@azure/arm-redis` |
| `eventBus` | Azure Event Grid Topics + Subscriptions | `@azure/arm-eventgrid` |
| `cron` | Timer-Triggered Azure Functions | `@azure/arm-appservice` |

## Additional Capabilities

- **Managed Identity RBAC**: Automatic least-privilege role assignments via `@azure/arm-authorization`
- **Drift Detection**: Live state inspection and drift remediation via Azure Resource Manager APIs
- **Azure Monitor**: Activity log streaming for function invocations
- **Retry Engine**: Exponential backoff with jitter for ARM rate limits (429), 5xx errors, and RBAC propagation delays

## Installation

```bash
npm install novaserve-provider-azure
# or
pnpm add novaserve-provider-azure
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|:---:|---|
| `AZURE_SUBSCRIPTION_ID` | ✅ | Azure subscription ID |
| `AZURE_TENANT_ID` | ✅ | Azure AD tenant ID |
| `AZURE_LOCATION` | ❌ | Default region (defaults to `eastus`) |
| `AZURE_RESOURCE_GROUP` | ❌ | Explicit resource group override |

### Authentication

The provider uses `DefaultAzureCredential` from `@azure/identity`, which supports:

1. **Environment Variables** — `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
2. **Azure CLI** — `az login`
3. **Managed Identity** — When running on Azure infrastructure
4. **Visual Studio Code** — Azure Account extension

### Usage

```typescript
import { defineApp, api, storage, secret, cron } from "novaserve";

export default defineApp({
  name: "my-azure-app",
  region: "eastus",
  runtime: "node20",
  provider: "azure",

  resources: {
    api: api.create({
      routes: {
        "GET /health": "src/handlers/health.get",
        "POST /users": "src/handlers/users.create",
      },
    }),
    uploads: storage.bucket("user-uploads", { maxSize: "10mb" }),
    stripeKey: secret.define("STRIPE_SECRET_KEY"),
    cleanup: cron.schedule("0 0 * * *", {
      handler: "src/handlers/cleanup.run",
    }),
  },
});
```

```bash
nova deploy --provider azure
```

## Documentation & Repository

- **Main Repository**: [https://github.com/novaserve-cloud/novaserve](https://github.com/novaserve-cloud/novaserve)
- **Primary Package**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

## License

Apache-2.0 © Md Shadab Azam Ansari & NovaServe Contributors
