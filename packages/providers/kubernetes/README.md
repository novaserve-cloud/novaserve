# NovaServe Kubernetes Provider

Production Kubernetes provider for NovaServe. It maps Nova IR deployment plans into Kubernetes API objects and applies them through `@kubernetes/client-node`; normal deploys do not shell out to `kubectl`.

## Configuration

```ts
export default defineApp({
  name: "orders",
  provider: "kubernetes",
  kubernetes: {
    context: "prod",
    expectedContext: "prod",
    expectedCluster: "production-cluster",
    namespace: "orders-prod",
    defaultImage: "ghcr.io/acme/orders:2026.08.17",
    waitForRollout: true,
    rolloutTimeoutSeconds: 300,
    networkPolicy: true,
  },
  resources: {
    // resources...
  },
});
```

Each API, function, cron, or queue worker must have an explicit container image through `resource.config.image`, `resource.config.kubernetes.image`, or `config.kubernetes.defaultImage`.

Set `kubernetes.apply: false` to render `.nova/kubernetes/resources.yaml` without touching a cluster.

## Resource Mapping

- API: `Deployment`, `Service`, optional `Ingress`, `ServiceAccount`, optional `HPA`, optional `PodDisruptionBudget`, optional `NetworkPolicy`
- Function: `Deployment`, `ServiceAccount`, optional `HPA`, optional `PodDisruptionBudget`, optional `NetworkPolicy`
- Cron: `CronJob`, `ServiceAccount`
- Secret: metadata-only Kubernetes `Secret`; secret values are not written to manifests or state
- Storage: `PersistentVolumeClaim`
- Environment variables: per-workload `ConfigMap`

Workloads default to non-root containers, no privilege escalation, dropped Linux capabilities, read-only root filesystems, resource requests/limits, probes, topology spread, rolling updates, and production replicas of 2 for API/function resources unless configured otherwise.

## Safety

All managed objects include NovaServe labels and annotations, including app, environment, IR hash, plan hash, deployment ID, and object hash. Updates and deletes refuse to touch existing objects that are not labeled as managed by NovaServe for the same app/environment.

`nova rollback --provider kubernetes` reapplies the Kubernetes object set stored in Nova deployment state for the selected previous deployment.
