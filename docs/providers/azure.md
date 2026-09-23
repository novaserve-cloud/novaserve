# Azure Provider (`novaserve-provider-azure`)

Target adapter for deploying NovaServe applications to Microsoft Azure.

## Status

**Experimental**

## Supported Primitives

- `function` → Azure Functions (Node.js runtime)
- `storage` → Azure Blob Storage
- `database` → Azure Cosmos DB / PostgreSQL

## Configuration

Set standard Azure authentication environment variables:

```bash
export AZURE_SUBSCRIPTION_ID="..."
export AZURE_TENANT_ID="..."
export AZURE_CLIENT_ID="..."
export AZURE_CLIENT_SECRET="..."
```
