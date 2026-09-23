# Cloudflare Provider (`novaserve-provider-cloudflare`)

Target adapter for deploying NovaServe applications to the Cloudflare Edge network.

## Status

**Experimental**

## Supported Primitives

- `function` / `api` → Cloudflare Workers
- `storage` → Cloudflare R2
- `database` → Cloudflare D1
- `cache` → Cloudflare KV

## Configuration

Set Cloudflare API tokens:

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
```
