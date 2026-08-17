import type {
  NovaProvider,
  ProviderStatus,
  DeploymentPlan,
  DeployResult,
  LogEntry,
  LogOptions,
  InvokeResult,
  ValidationResult,
  DeploymentPlanAction,
} from "novaserve-core";
import type { Resource, ResolvedResource } from "novaserve-core";
import type { NovaAppConfig } from "novaserve-sdk";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KubernetesApiClient } from "./client.js";
import {
  generateManifests,
  mapPlanToKubernetesBundles,
  mapResourceToKubernetesBundle,
  mapResourcesToKubernetesObjects,
  serializeManifests,
  UNSUPPORTED_TYPES,
  type KubernetesMappingContext,
} from "./mapper.js";
import type {
  KubernetesClient,
  KubernetesManifest,
  KubernetesProviderConfig,
  KubernetesProviderOptions,
  KubernetesResourceBundle,
} from "./types.js";

const WORKLOAD_TYPES = new Set(["api", "function", "cron", "queue"]);

export class KubernetesProvider implements NovaProvider {
  readonly name = "kubernetes";
  readonly displayName = "Kubernetes";

  private config?: NovaAppConfig;
  private client?: KubernetesClient;
  private readonly injectedClient?: KubernetesClient;
  private readonly now: () => Date;

  constructor(options: KubernetesProviderOptions = {}) {
    this.injectedClient = options.client;
    this.now = options.now || (() => new Date());
  }

  async init(config: NovaAppConfig): Promise<void> {
    this.config = config;
    this.client = this.injectedClient;
  }

  async validate(resources: Resource[]): Promise<ValidationResult> {
    const errors: Array<{ resource: string; message: string }> = [];
    const warnings: Array<{ resource: string; message: string }> = [];
    const k8sConfig = this.kubernetesConfig();

    for (const resource of resources) {
      if (UNSUPPORTED_TYPES.includes(resource.type)) {
        warnings.push({
          resource: resource.name,
          message: `Resource type '${resource.type}' is not natively supported by the Kubernetes provider and will be ignored.`,
        });
        continue;
      }

      if (WORKLOAD_TYPES.has(resource.type) && !hasImage(resource, k8sConfig)) {
        errors.push({
          resource: resource.name,
          message:
            "Kubernetes workloads require an explicit container image via resource.config.image, resource.config.kubernetes.image, or config.kubernetes.defaultImage.",
        });
      }

      const resourceErrors = validateResourceConfiguration(resource);
      errors.push(...resourceErrors.errors);
      warnings.push(...resourceErrors.warnings);
    }

    if (this.config && k8sConfig.apply !== false && k8sConfig.dryRun !== true) {
      const namespace = this.namespaceFor("production");
      const client = this.getClient();
      const clusterStatus = await client.getStatus(namespace);
      if (!clusterStatus.configured) {
        errors.push({
          resource: "cluster",
          message: clusterStatus.warnings[0] || "Kubernetes configuration is not available.",
        });
      }

      if (k8sConfig.expectedContext && clusterStatus.context !== k8sConfig.expectedContext) {
        errors.push({
          resource: "cluster",
          message: `Current context "${clusterStatus.context || "unknown"}" does not match expected context "${k8sConfig.expectedContext}".`,
        });
      }

      if (k8sConfig.expectedCluster && clusterStatus.cluster !== k8sConfig.expectedCluster) {
        errors.push({
          resource: "cluster",
          message: `Current cluster "${clusterStatus.cluster || "unknown"}" does not match expected cluster "${k8sConfig.expectedCluster}".`,
        });
      }

      warnings.push(...clusterStatus.warnings.map((message) => ({ resource: "cluster", message })));

      const access = await client.validateAccess(namespace);
      errors.push(...access.errors);
      warnings.push(...access.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async plan(
    resources: Resource[],
    currentState: ResolvedResource[]
  ): Promise<DeploymentPlan> {
    const currentMap = new Map<string, ResolvedResource>();
    for (const resource of currentState) {
      currentMap.set(`${resource.type}-${resource.name}`, resource);
    }

    const actions: DeploymentPlanAction[] = [];

    for (const resource of resources) {
      if (UNSUPPORTED_TYPES.includes(resource.type)) continue;

      const id = `${resource.type}-${resource.name}`;
      const existing = currentMap.get(id);

      if (!existing) {
        actions.push({
          action: "create",
          resource,
          reason: "New resource",
          dependsOn: resource.dependencies,
        });
      } else {
        const newHash = hashConfig(resource.config);

        if (newHash !== existing.configHash) {
          actions.push({
            action: "update",
            resource,
            reason: "Configuration changed",
            dependsOn: resource.dependencies,
          });
        } else {
          actions.push({
            action: "skip",
            resource,
            reason: "No changes",
            dependsOn: [],
          });
        }
        currentMap.delete(id);
      }
    }

    for (const resource of currentMap.values()) {
      actions.push({
        action: "delete",
        resource: {
          type: resource.type,
          name: resource.name,
          config: resource.config,
          dependencies: resource.dependencies,
        },
        reason: "Resource removed from configuration",
        dependsOn: [],
      });
    }

    return {
      appName: this.config?.name || "unknown",
      provider: this.name,
      environment: "production",
      actions,
      summary: summarize(actions),
    };
  }

  async deploy(plan: DeploymentPlan): Promise<DeployResult> {
    const startTime = Date.now();
    const errors: Array<{ resource: string; error: string }> = [];
    const outputs: Record<string, string> = {};
    const namespace = this.namespaceFor(plan.environment);
    const k8sConfig = this.kubernetesConfig();
    const bundles = mapPlanToKubernetesBundles(plan, namespace, k8sConfig);
    const outDir = this.writeManifestArtifact(plan, namespace, bundles);

    outputs.manifest = join(outDir, "resources.yaml");
    outputs.namespace = namespace;

    const shouldApply = k8sConfig.apply !== false && k8sConfig.dryRun !== true;
    if (shouldApply) {
      const client = this.getClient();
      const clusterStatus = await client.getStatus(namespace);
      outputs.context = clusterStatus.context || "";
      outputs.cluster = clusterStatus.cluster || "";

      await client.applyObject(mapResourcesToKubernetesObjects([], namespace, k8sConfig, {
        appName: plan.appName,
        environment: plan.environment,
        irHash: plan.irHash,
        planHash: plan.planHash,
        deploymentId: (plan as DeploymentPlan & { deploymentId?: string }).deploymentId,
        version: plan.version,
      })[0]!);

      const deleteActions = plan.actions.filter((action) => action.action === "delete");
      for (const action of deleteActions) {
        const deleteBundle = this.bundleForAction(action, plan, namespace, k8sConfig);
        try {
          for (const object of deleteOrder(deleteBundle.objects)) {
            await client.deleteObject(object);
          }
        } catch (error) {
          errors.push({ resource: `${action.resource.type}-${action.resource.name}`, error: messageFromError(error) });
        }
      }

      for (const action of plan.actions.filter((item) => item.action !== "delete" && item.action !== "skip")) {
        const bundle = bundles.find((item) => item.resource.type === action.resource.type && item.resource.name === action.resource.name);
        if (!bundle) continue;

        try {
          for (const object of bundle.objects) {
            await client.applyObject(object);
          }
        } catch (error) {
          errors.push({ resource: `${action.resource.type}-${action.resource.name}`, error: messageFromError(error) });
        }
      }

      if (errors.length === 0 && k8sConfig.waitForRollout !== false) {
        const changedKeys = new Set(plan.actions
          .filter((action) => action.action !== "delete" && action.action !== "skip")
          .map((action) => `${action.resource.type}-${action.resource.name}`));
        for (const bundle of bundles.filter((item) => changedKeys.has(`${item.resource.type}-${item.resource.name}`))) {
          for (const deployment of bundle.objects.filter((object) => object.kind === "Deployment")) {
            try {
              await client.waitForDeployment(
                namespace,
                deployment.metadata.name,
                k8sConfig.rolloutTimeoutSeconds || 300
              );
            } catch (error) {
              errors.push({ resource: `${bundle.resource.type}-${bundle.resource.name}`, error: messageFromError(error) });
            }
          }
        }
      }
    } else {
      outputs.kubernetes = "Rendered Kubernetes manifests only; API apply disabled.";
    }

    for (const bundle of bundles) {
      Object.assign(outputs, bundle.outputs);
    }

    return {
      success: errors.length === 0,
      resources: bundles.map((bundle) => this.toResolvedResource(bundle, plan, namespace)),
      durationMs: Date.now() - startTime,
      errors,
      outputs,
    };
  }

  async destroy(resources: ResolvedResource[]): Promise<void> {
    const k8sConfig = this.kubernetesConfig();
    if (k8sConfig.apply === false || k8sConfig.dryRun === true) {
      return;
    }

    const client = this.getClient();
    const errors: string[] = [];

    for (const resource of resources) {
      const namespace = this.namespaceFromResource(resource) || this.namespaceFor("production");
      const objects = this.objectsFromResolvedResource(resource, namespace, k8sConfig);
      for (const object of deleteOrder(objects)) {
        try {
          await client.deleteObject(object);
        } catch (error) {
          errors.push(`${object.kind}/${object.metadata.name}: ${messageFromError(error)}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Kubernetes destroy failed:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
    }
  }

  async rollback(resources: ResolvedResource[]): Promise<DeployResult> {
    const startTime = Date.now();
    const namespace = resources[0] ? this.namespaceFromResource(resources[0]) || this.namespaceFor("production") : this.namespaceFor("production");
    const k8sConfig = this.kubernetesConfig();
    const errors: Array<{ resource: string; error: string }> = [];
    const outputs: Record<string, string> = { namespace };

    if (k8sConfig.apply === false || k8sConfig.dryRun === true) {
      return {
        success: true,
        resources,
        durationMs: Date.now() - startTime,
        errors: [],
        outputs: { ...outputs, kubernetes: "Rollback manifests restored in state only; API apply disabled." },
      };
    }

    const client = this.getClient();
    for (const resource of resources) {
      const objects = this.objectsFromResolvedResource(resource, namespace, k8sConfig);
      try {
        for (const object of objects) {
          await client.applyObject(object);
        }
      } catch (error) {
        errors.push({ resource: `${resource.type}-${resource.name}`, error: messageFromError(error) });
      }
    }

    if (errors.length === 0 && k8sConfig.waitForRollout !== false) {
      for (const resource of resources) {
        const objects = this.objectsFromResolvedResource(resource, namespace, k8sConfig);
        for (const deployment of objects.filter((object) => object.kind === "Deployment")) {
          try {
            await client.waitForDeployment(deployment.metadata.namespace || namespace, deployment.metadata.name, k8sConfig.rolloutTimeoutSeconds || 300);
          } catch (error) {
            errors.push({ resource: `${resource.type}-${resource.name}`, error: messageFromError(error) });
          }
        }
      }
    }

    return {
      success: errors.length === 0,
      resources,
      durationMs: Date.now() - startTime,
      errors,
      outputs,
    };
  }

  async *getLogs(
    resource: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    const namespace = this.namespaceFor("production");
    const appName = this.config?.name || "nova-app";
    const selector = {
      "app.kubernetes.io/managed-by": "novaserve",
      "novaserve.cloud/app": sanitizeLabelValue(appName),
      "novaserve.cloud/workload": sanitizeLabelValue(resource.includes("-") ? resource : `function-${resource}`),
    };

    for await (const entry of this.getClient().getLogs(namespace, selector, {
      limit: options?.limit,
      since: options?.since,
      follow: options?.follow,
    })) {
      yield {
        timestamp: entry.timestamp,
        level: "info",
        resource: entry.pod,
        message: entry.message,
      };
    }
  }

  async invoke(_functionName: string, _payload: unknown): Promise<InvokeResult> {
    return {
      statusCode: 501,
      body: { message: "Direct invoke is not natively supported for the Kubernetes provider. Use Service/Ingress endpoints or kubectl port-forward operationally." },
      headers: {},
      durationMs: 0,
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    const namespace = this.namespaceFor("production");
    const status = await this.getClient().getStatus(namespace);

    return {
      name: this.displayName,
      configured: status.configured,
      region: status.namespace,
      account: status.context || status.cluster,
      warnings: [
        `Current cluster: ${status.cluster || "unknown"}`,
        `Context: ${status.context || "unknown"}`,
        `Namespace: ${status.namespace}`,
        ...status.warnings,
      ],
    };
  }

  private getClient(): KubernetesClient {
    if (!this.client) {
      this.client = new KubernetesApiClient({ config: this.kubernetesConfig() });
    }
    return this.client;
  }

  private namespaceFor(environment: string): string {
    const k8sConfig = this.kubernetesConfig();
    return k8sConfig.namespace || this.config?.name || (environment === "production" ? "default" : `nova-${environment}`);
  }

  private kubernetesConfig(): KubernetesProviderConfig {
    return ((this.config as NovaAppConfig & { kubernetes?: KubernetesProviderConfig } | undefined)?.kubernetes || {}) as KubernetesProviderConfig;
  }

  private writeManifestArtifact(
    plan: DeploymentPlan,
    namespace: string,
    bundles: KubernetesResourceBundle[]
  ): string {
    const outDir = join(process.cwd(), ".nova", "kubernetes");
    mkdirSync(outDir, { recursive: true });

    const namespaceManifest = mapResourcesToKubernetesObjects([], namespace, this.kubernetesConfig(), {
      appName: plan.appName,
      environment: plan.environment,
      irHash: plan.irHash,
      planHash: plan.planHash,
      deploymentId: (plan as DeploymentPlan & { deploymentId?: string }).deploymentId,
      version: plan.version,
    });
    writeFileSync(join(outDir, "resources.yaml"), serializeManifests([...namespaceManifest, ...bundles.flatMap((bundle) => bundle.objects)]));
    writeFileSync(join(outDir, "kustomization.yaml"), "apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n  - resources.yaml\n");
    return outDir;
  }

  private bundleForAction(
    action: DeploymentPlanAction,
    plan: DeploymentPlan,
    namespace: string,
    providerConfig: KubernetesProviderConfig
  ): KubernetesResourceBundle {
    const context: KubernetesMappingContext = {
      appName: plan.appName,
      environment: plan.environment,
      namespace,
      irHash: plan.irHash,
      planHash: plan.planHash,
      deploymentId: (plan as DeploymentPlan & { deploymentId?: string }).deploymentId,
      version: plan.version,
      providerConfig,
    };
    return mapResourceToKubernetesBundle(action.resource, context);
  }

  private toResolvedResource(
    bundle: KubernetesResourceBundle,
    plan: DeploymentPlan,
    namespace: string
  ): ResolvedResource {
    return {
      type: bundle.resource.type,
      name: bundle.resource.name,
      config: bundle.resource.config,
      dependencies: bundle.resource.dependencies,
      id: bundle.providerId,
      configHash: hashConfig(bundle.resource.config),
      status: "deployed",
      provider: this.name,
      providerId: bundle.providerId,
      region: namespace,
      providerConfig: {
        kubernetes: {
          namespace,
          apiVersion: "v1",
          objects: bundle.objects,
          irHash: plan.irHash,
          planHash: plan.planHash,
          deploymentId: (plan as DeploymentPlan & { deploymentId?: string }).deploymentId,
        },
      },
      outputs: bundle.outputs,
    };
  }

  private objectsFromResolvedResource(
    resource: ResolvedResource,
    namespace: string,
    providerConfig: KubernetesProviderConfig
  ): KubernetesManifest[] {
    const saved = (resource.providerConfig?.kubernetes as { objects?: KubernetesManifest[] } | undefined)?.objects;
    if (Array.isArray(saved) && saved.length > 0) {
      return saved;
    }

    return mapResourceToKubernetesBundle(resource, {
      appName: this.config?.name || "nova-app",
      environment: "production",
      namespace,
      providerConfig,
    }).objects;
  }

  private namespaceFromResource(resource: ResolvedResource): string | undefined {
    return (resource.providerConfig?.kubernetes as { namespace?: string } | undefined)?.namespace
      || resource.region;
  }
}

export { generateManifests };

function deleteOrder(objects: KubernetesManifest[]): KubernetesManifest[] {
  const weight: Record<string, number> = {
    Ingress: 10,
    HorizontalPodAutoscaler: 20,
    PodDisruptionBudget: 30,
    NetworkPolicy: 40,
    Service: 50,
    Deployment: 60,
    CronJob: 60,
    RoleBinding: 70,
    Role: 80,
    ServiceAccount: 90,
    ConfigMap: 100,
    Secret: 110,
    PersistentVolumeClaim: 120,
  };

  return [...objects].sort((a, b) => (weight[a.kind] || 1000) - (weight[b.kind] || 1000));
}

function validateResourceConfiguration(resource: Resource): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  const replicas = numberFrom(resource.config.replicas);
  if (replicas !== undefined && (!Number.isInteger(replicas) || replicas < 0)) {
    errors.push({ resource: resource.name, message: "replicas must be a non-negative integer." });
  }

  const scaling = recordFrom(resource.config.scaling);
  if (scaling) {
    const min = numberFrom(scaling.minReplicas);
    const max = numberFrom(scaling.maxReplicas);
    const cpu = numberFrom(scaling.cpu);
    const memory = numberFrom(scaling.memory);

    if (min !== undefined && min < 1) errors.push({ resource: resource.name, message: "scaling.minReplicas must be at least 1 for standard Kubernetes HPA." });
    if (max !== undefined && max < 1) errors.push({ resource: resource.name, message: "scaling.maxReplicas must be at least 1." });
    if (min !== undefined && max !== undefined && min > max) errors.push({ resource: resource.name, message: "scaling.minReplicas cannot exceed scaling.maxReplicas." });
    if (cpu !== undefined && (cpu < 1 || cpu > 100)) errors.push({ resource: resource.name, message: "scaling.cpu must be a utilization percentage from 1 to 100." });
    if (memory !== undefined && (memory < 1 || memory > 100)) errors.push({ resource: resource.name, message: "scaling.memory must be a utilization percentage from 1 to 100." });
  }

  const resources = recordFrom(resource.config.resources);
  if (resources) {
    for (const path of ["requests.cpu", "requests.memory", "limits.cpu", "limits.memory"]) {
      const value = readNested(resources, path);
      if (value !== undefined && typeof value !== "string") {
        errors.push({ resource: resource.name, message: `resources.${path} must be a Kubernetes quantity string.` });
      }
    }
  }

  const env = recordFrom(resource.config.environment) || recordFrom(resource.config.env);
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (/secret|password|token|credential|private[_-]?key/i.test(key) && typeof value === "string" && value.length > 0) {
        warnings.push({
          resource: resource.name,
          message: `Environment variable "${key}" looks sensitive. Use secretRefs so secret values are not stored in Nova IR, state, manifests, or logs.`,
        });
      }
    }
  }

  if (resource.type === "database") {
    warnings.push({
      resource: resource.name,
      message: "In-cluster databases require backup, upgrade, and HA operations. Prefer a database operator or external managed database for production.",
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

function hasImage(resource: Resource, providerConfig: KubernetesProviderConfig): boolean {
  return Boolean(
    stringFrom(resource.config.image)
    || stringFrom(readNested(resource.config, "container.image"))
    || stringFrom(readNested(resource.config, "kubernetes.image"))
    || providerConfig.defaultImage
  );
}

function summarize(actions: DeploymentPlanAction[]): DeploymentPlan["summary"] {
  return {
    create: actions.filter((action) => action.action === "create").length,
    update: actions.filter((action) => action.action === "update").length,
    replace: actions.filter((action) => action.action === "replace").length,
    delete: actions.filter((action) => action.action === "delete").length,
    skip: actions.filter((action) => action.action === "skip").length,
  };
}

function hashConfig(config: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(config)).digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, objectValue) => {
    if (objectValue && typeof objectValue === "object" && !Array.isArray(objectValue)) {
      return Object.keys(objectValue)
        .sort()
        .reduce((acc: Record<string, unknown>, key) => {
          acc[key] = objectValue[key];
          return acc;
        }, {});
    }
    return objectValue;
  });
}

function recordFrom(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNested(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sanitizeLabelValue(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (normalized.length <= 63) return normalized || "resource";
  const suffix = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return `${normalized.slice(0, 54)}-${suffix}`.replace(/[^a-z0-9]+$/g, "");
}
