<p align="center">
  <img src="https://raw.githubusercontent.com/novaserve-cloud/novaserve/main/docs/assets/logo.svg" height="80" alt="NovaServe Logo" />
</p>

# novaserve-provider-gcp

> Google Cloud Platform deployment provider for **NovaServe** — **Production Ready**.

Target adapter compiling Nova IR graphs to Google Cloud Platform serverless infrastructure. Supports Cloud Functions, Cloud Storage, Cloud SQL, Pub/Sub, Cloud Scheduler, Memorystore, API Gateway, and Secret Manager.

## Supported Services

| NovaServe Primitive | GCP Service | Status |
|---|---|:---:|
| HTTP API / Function | Cloud Functions (2nd gen) | ✅ Production |
| Storage | Cloud Storage | ✅ Production |
| Queue | Pub/Sub | ✅ Production |
| Cron | Cloud Scheduler | ✅ Production |
| Database (PostgreSQL/MySQL) | Cloud SQL | ✅ Production |
| Cache (Redis) | Memorystore | ✅ Production |
| API | API Gateway | ✅ Production |
| Secrets | Secret Manager | ✅ Production |

## Installation

```bash
npm install novaserve-provider-gcp
# or
pnpm add novaserve-provider-gcp
```

## Configuration

### Authentication

The GCP provider uses [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials):

```bash
# Option 1: gcloud CLI (recommended for development)
gcloud auth application-default login

# Option 2: Service account key file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### Required GCP APIs

Enable the following APIs in your GCP project:

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  apigateway.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com
```

### Required IAM Roles

The deployment service account requires these minimum roles:

| Service | IAM Role |
|---|---|
| Cloud Functions | `roles/cloudfunctions.developer` |
| Cloud Storage | `roles/storage.objectAdmin` |
| Pub/Sub | `roles/pubsub.editor` |
| Cloud Scheduler | `roles/cloudscheduler.admin` |
| Cloud SQL | `roles/cloudsql.client` |
| Memorystore | `roles/redis.editor` |
| Secret Manager | `roles/secretmanager.secretAccessor` |
| API Gateway | `roles/apigateway.admin` |

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | Auto-detected |
| `GOOGLE_CLOUD_REGION` | Deployment region | `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account key path | ADC |

## Usage

```typescript
// nova.config.ts
import { defineConfig } from "novaserve-sdk";

export default defineConfig({
  name: "my-app",
  provider: "gcp",
  region: "us-central1",
  resources: [
    { type: "function", name: "api", config: { memory: 256, timeout: 60 } },
    { type: "storage", name: "uploads" },
    { type: "queue", name: "jobs" },
    { type: "database", name: "db", config: { engine: "postgres" } },
    { type: "cache", name: "sessions" },
    { type: "cron", name: "cleanup", config: { schedule: "0 0 * * *" } },
    { type: "secret", name: "api-key" },
  ],
});
```

## Documentation & Repository

- **Main Repository**: [https://github.com/novaserve-cloud/novaserve](https://github.com/novaserve-cloud/novaserve)
- **Primary Package**: [https://www.npmjs.com/package/novaserve](https://www.npmjs.com/package/novaserve)

## License

Apache-2.0 © Md Shadab Azam Ansari & NovaServe Contributors
