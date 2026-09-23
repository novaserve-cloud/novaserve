# Docker Provider (`novaserve-provider-docker`)

Target adapter for containerizing and orchestrating NovaServe applications using Docker and Docker Compose.

## Status

**Experimental**

## Features

- Generates hardened multi-stage Dockerfiles for Node.js runtimes.
- Generates production-ready `docker-compose.yml` with isolated internal networks.
- Bundles local PostgreSQL databases and Redis caches when configured.
