# Nova Intermediate Representation (Nova IR 1.0.0)

Nova IR is a vendor-neutral, JSON-serialized specification of your declared infrastructure.

## Schema Highlights

```json
{
  "schemaVersion": "1.0.0",
  "app": {
    "name": "my-api",
    "version": "1.0.0",
    "environment": "production",
    "region": "us-east-1",
    "hash": "8f3b20..."
  },
  "resources": {
    "function-getUser": {
      "id": "function-getUser",
      "type": "function",
      "name": "getUser",
      "configHash": "c2a9...",
      "config": {
        "memory": 512,
        "timeout": 30
      },
      "dependencies": []
    }
  },
  "dependencies": [],
  "permissions": []
}
```

## Determinism & Hashing

Keys are canonically sorted during hashing (`computeCanonicalHash`), guaranteeing that unchanged code produces the exact same hash regardless of runtime ordering or formatting.
