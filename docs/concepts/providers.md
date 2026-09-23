# Provider Architecture

NovaServe uses a pluggable target adapter model to decouple developer application definitions from vendor-specific infrastructure APIs.

## Provider Responsibilities

Each provider implements the `NovaProvider` interface:

- `getStatus()`: Inspects local/cloud credentials and connectivity.
- `validate(resources)`: Validates resource compatibility and parameters.
- `deploy(plan)`: Applies the execution plan against the cloud vendor API.
- `destroy(resources)`: Tears down resources in reverse dependency order.

## Provider Matrix Status

| Provider | Status | Primary Primitives |
|---|:---:|---|
| **Local** | **Production** | In-process Hono HTTP server, memory queue, file storage |
| **AWS** | **Production** | API Gateway v2, Lambda, S3, SQS, DynamoDB, IAM |
| **Cloudflare** | Experimental | Workers, R2, D1, KV |
| **Docker** | Experimental | Docker Compose services & networks |
| **Kubernetes** | Experimental | Deployments, Services, ConfigMaps |
| **Azure** | Experimental | Azure Functions, Blob Storage |
| **GCP** | Experimental | Cloud Functions, Cloud Storage, Pub/Sub |
