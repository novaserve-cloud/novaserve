# NovaServe Docker Provider

The `novaserve-provider-docker` package provides production-ready deployment of NovaServe applications to Docker environments. It generates multi-stage Dockerfiles and Docker Compose orchestrations from your Nova IR configuration.

This provider transforms your serverless configuration into a robust, secure, and production-ready containerized application suitable for local hosting, VPS deployments, private clouds, or on-premise infrastructure.

## Features

- **Multi-stage Dockerfiles**: Optimized builds utilizing `node:*-alpine` or custom base images.
- **Production Compose Orchestration**: Maps Nova resources (API, functions, workers, cron, databases, caches) to Docker Compose services.
- **Security Hardened**: Non-root users (`uid 1001`), read-only root filesystems, dropped capabilities (`cap_drop: ALL`), and `no-new-privileges` by default.
- **Health Checks**: Wait-for-health deployment lifecycle using HTTP or command-based health checks.
- **Dependency Bundling**: Automatically bundle and orchestrate managed databases (PostgreSQL, MySQL, MongoDB, Redis) and S3-compatible object storage (MinIO) for fully self-hosted deployments.
- **Graceful Shutdown**: Sends `SIGTERM` and handles configurable stop grace periods to prevent dropped connections.
- **Resource Limits**: Apply CPU and memory limits (`deploy.resources`) to individual containers or globally.
- **Secret Management**: Safely isolates config from secrets using `.env.example` placeholder generation, avoiding committed secrets.

## Installation

The Docker provider is included natively in the NovaServe CLI.

```bash
npm install novaserve-provider-docker
```

## Configuration

Configure the Docker provider in your `nova.config.ts`:

```typescript
import { defineApp, api, database } from "novaserve";

export default defineApp({
  name: "my-app",
  provider: "docker", // Set default provider
  docker: {
    // Docker-specific settings
    bundleDependencies: true, // Run local Postgres/Redis via Compose
    restartPolicy: "unless-stopped",
    stopGracePeriod: 30, // seconds
    
    // Global resource limits
    resources: {
      limits: { cpus: "2", memory: "1G" },
      reservations: { cpus: "0.5", memory: "256M" }
    },
    
    // Security options
    security: {
      nonRoot: true, // Run as 'novaserve' user
      readOnlyRootFilesystem: true,
      tmpfsMounts: ["/tmp"]
    },
    
    // Deployment health checks
    healthCheck: {
      type: "http",
      endpoint: "/health",
      interval: 15, // seconds
      timeout: 5,
      retries: 3
    }
  },
  resources: {
    api: api.create({ routes: { "GET /": "src/index.handler" } }),
    db: database.postgres()
  },
});
```

## Deployment Lifecycle

Deploy your application using the NovaServe CLI:

```bash
nova deploy --provider docker
```

The Docker provider executes a robust deployment lifecycle:

1. **Artifact Generation**: Generates `Dockerfile`, `compose.yaml`, `.dockerignore`, and `.env` templates in `.nova/docker/`.
2. **Build**: Executes a BuildKit-optimized build of your application image.
3. **Deploy**: Starts the infrastructure using `docker compose up -d`.
4. **Health Verification**: Polls container health and HTTP health endpoints, ensuring the deployment is successful before marking it as ready.
5. **Registry Push (Optional)**: If configured, tags and pushes the image to your container registry.

## Container Registry Integration

You can configure the provider to automatically push to a registry (Docker Hub, GHCR, ECR, etc.):

```typescript
docker: {
  registry: {
    url: "ghcr.io",
    repository: "my-org/my-app",
    tagStrategy: "git-commit", // Uses current git commit hash
    push: true
  }
}
```

Make sure you are authenticated with the registry (`docker login ghcr.io`) before deploying.

## Secrets & Environment Variables

NovaServe strictly separates configuration from secrets. When deploying with Docker:

- The provider generates a `.env.example` containing all required environment variables with `<CHANGE_ME>` placeholders.
- A `.env` template is also generated (if it does not exist) that automatically wires internal services together (e.g., automatically generating `DATABASE_URL` linking your API container to your Postgres container).
- **Secrets** (defined via `secret()` in NovaServe) are left blank in the `.env` template. You must provide them at deployment time.

> **Warning**: Never commit `.env` files to version control. The provider automatically adds them to `.dockerignore` and `.gitignore`.

## Service Discovery (Dependency Bundling)

By default (`bundleDependencies: false`), the Docker provider assumes your databases and caches are hosted externally (e.g., RDS, ElastiCache) and expects you to provide connection strings via environment variables.

For fully self-hosted deployments, set `docker.bundleDependencies = true`. The provider will automatically inject containers for Postgres, MySQL, MongoDB, Redis, and MinIO into your Compose orchestration, create isolated internal networks, and wire the connection strings securely between containers.

## Cleanup

To tear down the deployment:

```bash
nova destroy --provider docker
```

By default, data volumes are **retained** to prevent accidental data loss. To remove volumes, run `docker compose down --volumes` manually in the `.nova/docker/` directory.
