# Kubernetes Provider (`novaserve-provider-kubernetes`)

Target adapter for compiling NovaServe applications into native Kubernetes resources.

## Status

**Experimental**

## Generated Manifests

- Kubernetes `Deployment` with rolling updates and resource quotas
- Kubernetes `Service` (ClusterIP / LoadBalancer)
- `ConfigMap` and `Secret` bindings for environment variables
- Health check `livenessProbe` and `readinessProbe` definitions
