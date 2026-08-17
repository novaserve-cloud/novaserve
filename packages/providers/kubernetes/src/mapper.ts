import { createHash } from "node:crypto";
import type { DeploymentPlan, Resource } from "novaserve-core";
import type {
  KubernetesManifest,
  KubernetesProviderConfig,
  KubernetesResourceBundle,
  KubernetesSecretRef,
} from "./types.js";

export const UNSUPPORTED_TYPES = ["cdn", "websocket", "email", "search", "auth"];

const MANAGED_BY_LABEL = "app.kubernetes.io/managed-by";
const MANAGED_BY_VALUE = "novaserve";

export interface KubernetesMappingContext {
  appName: string;
  environment: string;
  namespace: string;
  irHash?: string;
  planHash?: string;
  deploymentId?: string;
  version?: string;
  providerConfig: KubernetesProviderConfig;
}

export function mapPlanToKubernetesBundles(
  plan: DeploymentPlan,
  namespace: string,
  providerConfig: KubernetesProviderConfig = {}
): KubernetesResourceBundle[] {
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

  return plan.actions
    .filter((action) => action.action !== "delete" && !UNSUPPORTED_TYPES.includes(action.resource.type))
    .map((action) => mapResourceToKubernetesBundle(action.resource, context));
}

export function mapResourceToKubernetesBundle(
  resource: Resource,
  context: KubernetesMappingContext
): KubernetesResourceBundle {
  const objects = mapResourceObjects(resource, context);
  const primary = objects.find((object) => object.kind === "Deployment" || object.kind === "CronJob" || object.kind === "PersistentVolumeClaim" || object.kind === "Secret") || objects[0];
  const providerId = primary
    ? `kubernetes:${primary.apiVersion}:${primary.kind}:${primary.metadata.namespace || context.namespace}:${primary.metadata.name}`
    : `kubernetes:${resource.type}:${resource.name}`;

  const outputs: Record<string, string> = {};
  const service = objects.find((object) => object.kind === "Service");
  const ingress = objects.find((object) => object.kind === "Ingress");
  if (service) {
    outputs[`${resource.name}_service`] = `${service.metadata.name}.${context.namespace}.svc.cluster.local`;
  }
  if (ingress) {
    const rules = (ingress.spec as { rules?: Array<{ host?: string }> } | undefined)?.rules || [];
    if (rules[0]?.host) {
      outputs[`${resource.name}_url`] = `https://${rules[0].host}`;
    }
  }

  return {
    resource,
    providerId,
    objects,
    outputs,
  };
}

export function mapResourcesToKubernetesObjects(
  resources: Resource[],
  namespace = "default",
  providerConfig: KubernetesProviderConfig = {},
  planMetadata: Partial<Pick<KubernetesMappingContext, "appName" | "environment" | "irHash" | "planHash" | "deploymentId" | "version">> = {}
): KubernetesManifest[] {
  const context: KubernetesMappingContext = {
    appName: planMetadata.appName || "nova-app",
    environment: planMetadata.environment || "production",
    namespace,
    irHash: planMetadata.irHash,
    planHash: planMetadata.planHash,
    deploymentId: planMetadata.deploymentId,
    version: planMetadata.version,
    providerConfig,
  };

  return [
    namespaceObject(namespace, context),
    ...resources
      .filter((resource) => !UNSUPPORTED_TYPES.includes(resource.type))
      .flatMap((resource) => mapResourceObjects(resource, context)),
  ];
}

function mapResourceObjects(resource: Resource, context: KubernetesMappingContext): KubernetesManifest[] {
  switch (resource.type) {
    case "api":
      return apiObjects(resource, context);
    case "function":
      return workloadObjects(resource, context, "function");
    case "queue":
      return workloadObjects(resource, context, "worker");
    case "cron":
      return cronObjects(resource, context);
    case "storage":
      return [pvcObject(resource, context)];
    case "secret":
      return [secretObject(resource, context)];
    case "cache":
      return cacheObjects(resource, context);
    case "database":
      return databaseObjects(resource, context);
    default:
      return [];
  }
}

function apiObjects(resource: Resource, context: KubernetesMappingContext): KubernetesManifest[] {
  const objects = workloadObjects(resource, context, "api");
  const name = workloadName(resource);
  const config = resource.config;
  const port = numberValue(config.port, 3000);
  const servicePort = numberValue(config.servicePort, 80);
  const serviceType = stringValue(config.serviceType) || "ClusterIP";

  objects.push({
    apiVersion: "v1",
    kind: "Service",
    metadata: metadata(resource, context, name, "service"),
    spec: {
      type: serviceType,
      selector: workloadSelector(resource, context),
      ports: [
        {
          name: "http",
          port: servicePort,
          targetPort: port,
          protocol: "TCP",
        },
      ],
    },
  });

  const domain = stringValue(config.domain) || stringValue(readNested(config, "ingress.host"));
  const ingressEnabled = Boolean(domain || readNested(config, "ingress.enabled"));
  if (ingressEnabled) {
    const host = domain || `${name}.example.invalid`;
    const ingressAnnotations = recordValue(readNested(config, "ingress.annotations"));
    objects.push({
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: metadata(resource, context, name, "ingress", {}, ingressAnnotations),
      spec: compactObject({
        ingressClassName:
          stringValue(readNested(config, "ingress.className")) || context.providerConfig.ingressClassName,
        tls: ingressTls(host, stringValue(readNested(config, "ingress.tlsSecretName")) || context.providerConfig.tlsSecretName),
        rules: [
          {
            host,
            http: {
              paths: [
                {
                  path: stringValue(readNested(config, "ingress.path")) || stringValue(config.basePath) || "/",
                  pathType: "Prefix",
                  backend: {
                    service: {
                      name,
                      port: { number: servicePort },
                    },
                  },
                },
              ],
            },
          },
        ],
      }),
    });
  }

  return objects;
}

function workloadObjects(resource: Resource, context: KubernetesMappingContext, component: string): KubernetesManifest[] {
  const config = resource.config;
  const name = workloadName(resource);
  const replicas = desiredReplicas(resource, context);
  const port = numberValue(config.port, component === "worker" ? 8080 : 3000);
  const container = workloadContainer(resource, context, component, port);
  const serviceAccountName = stringValue(readNested(config, "kubernetes.serviceAccountName"))
    || context.providerConfig.serviceAccountName
    || name;
  const rbacRules = arrayValue(readNested(config, "kubernetes.rbac.rules")) || arrayValue(readNested(config, "rbac.rules"));
  const podLabels = workloadSelector(resource, context);
  const objects: KubernetesManifest[] = [];

  const configMap = configMapObject(resource, context);
  if (configMap) objects.push(configMap);

  objects.push(serviceAccountObject(resource, context, serviceAccountName));

  if (rbacRules && rbacRules.length > 0) {
    objects.push(roleObject(resource, context, rbacRules));
    objects.push(roleBindingObject(resource, context, serviceAccountName));
  }

  objects.push({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: metadata(resource, context, name, component),
    spec: {
      replicas,
      revisionHistoryLimit: numberValue(config.revisionHistoryLimit, 10),
      progressDeadlineSeconds: numberValue(config.progressDeadlineSeconds, 600),
      minReadySeconds: numberValue(config.minReadySeconds, 5),
      strategy: {
        type: "RollingUpdate",
        rollingUpdate: {
          maxUnavailable: config.maxUnavailable ?? (replicas > 1 ? "25%" : 0),
          maxSurge: config.maxSurge ?? 1,
        },
      },
      selector: { matchLabels: podLabels },
      template: {
        metadata: {
          labels: podLabels,
          annotations: {
            "novaserve.cloud/config-hash": resourceConfigHash(resource),
          },
        },
        spec: compactObject({
          serviceAccountName,
          automountServiceAccountToken: Boolean(rbacRules && rbacRules.length > 0),
          terminationGracePeriodSeconds: numberValue(config.terminationGracePeriodSeconds, 30),
          imagePullSecrets: imagePullSecrets(context, config),
          securityContext: {
            runAsNonRoot: true,
            seccompProfile: { type: "RuntimeDefault" },
          },
          containers: [container],
          volumes: podVolumes(resource),
          affinity: podAffinity(resource, context),
          topologySpreadConstraints: topologySpreadConstraints(resource, context),
        }),
      },
    },
  });

  if (replicas > 1 && readNested(config, "pdb.enabled") !== false) {
    objects.push(podDisruptionBudgetObject(resource, context, replicas));
  }

  const scaling = recordValue(config.scaling);
  const maxReplicas = numberValue(scaling?.maxReplicas, undefined);
  if (scaling && maxReplicas && maxReplicas > replicas) {
    objects.push(hpaObject(resource, context, replicas, maxReplicas));
  }

  if (shouldCreateNetworkPolicy(resource, context)) {
    objects.push(networkPolicyObject(resource, context, port));
  }

  return objects;
}

function cronObjects(resource: Resource, context: KubernetesMappingContext): KubernetesManifest[] {
  const config = resource.config;
  const name = workloadName(resource);
  const serviceAccountName = stringValue(readNested(config, "kubernetes.serviceAccountName"))
    || context.providerConfig.serviceAccountName
    || name;
  const rbacRules = arrayValue(readNested(config, "kubernetes.rbac.rules")) || arrayValue(readNested(config, "rbac.rules"));
  const container = workloadContainer(resource, context, "cron", numberValue(config.port, 8080), false);
  const objects: KubernetesManifest[] = [];
  const configMap = configMapObject(resource, context);
  if (configMap) objects.push(configMap);

  objects.push(serviceAccountObject(resource, context, serviceAccountName));

  if (rbacRules && rbacRules.length > 0) {
    objects.push(roleObject(resource, context, rbacRules));
    objects.push(roleBindingObject(resource, context, serviceAccountName));
  }

  objects.push({
    apiVersion: "batch/v1",
    kind: "CronJob",
    metadata: metadata(resource, context, name, "cron"),
    spec: {
      schedule: stringValue(config.schedule) || "0 * * * *",
      suspend: config.enabled === false,
      concurrencyPolicy: stringValue(config.concurrencyPolicy) || "Forbid",
      startingDeadlineSeconds: numberValue(config.startingDeadlineSeconds, 300),
      successfulJobsHistoryLimit: numberValue(config.successfulJobsHistoryLimit, 3),
      failedJobsHistoryLimit: numberValue(config.failedJobsHistoryLimit, 3),
      jobTemplate: {
        spec: {
          backoffLimit: numberValue(config.backoffLimit, 2),
          template: {
            metadata: {
              labels: workloadSelector(resource, context),
              annotations: {
                "novaserve.cloud/config-hash": resourceConfigHash(resource),
              },
            },
            spec: compactObject({
              serviceAccountName,
              automountServiceAccountToken: Boolean(rbacRules && rbacRules.length > 0),
              restartPolicy: "OnFailure",
              terminationGracePeriodSeconds: numberValue(config.terminationGracePeriodSeconds, 30),
              imagePullSecrets: imagePullSecrets(context, config),
              securityContext: {
                runAsNonRoot: true,
                seccompProfile: { type: "RuntimeDefault" },
              },
              containers: [container],
              volumes: podVolumes(resource),
            }),
          },
        },
      },
    },
  });

  return objects;
}

function cacheObjects(resource: Resource, context: KubernetesMappingContext): KubernetesManifest[] {
  const config = resource.config;
  const cacheConfig = {
    ...config,
    image: stringValue(config.image) || "redis:7-alpine",
    port: numberValue(config.port, 6379),
    replicas: numberValue(config.replicas, 1),
    singleton: true,
    probes: false,
  };
  return workloadObjects({ ...resource, config: cacheConfig }, context, "cache").concat({
    apiVersion: "v1",
    kind: "Service",
    metadata: metadata(resource, context, workloadName(resource), "service"),
    spec: {
      type: "ClusterIP",
      selector: workloadSelector(resource, context),
      ports: [{ name: "redis", port: 6379, targetPort: 6379, protocol: "TCP" }],
    },
  });
}

function databaseObjects(resource: Resource, context: KubernetesMappingContext): KubernetesManifest[] {
  const engine = stringValue(resource.config.engine) || "postgres";
  const port = engine === "mysql" ? 3306 : engine === "mongodb" ? 27017 : 5432;
  const image = stringValue(resource.config.image)
    || (engine === "mysql" ? "mysql:8" : engine === "mongodb" ? "mongo:7" : "postgres:16");
  const statefulResource = {
    ...resource,
    config: {
      ...resource.config,
      image,
      port,
      replicas: 1,
      singleton: true,
      probes: false,
      resources: resource.config.resources || {
        requests: { cpu: "250m", memory: "512Mi" },
        limits: { cpu: "1", memory: "1Gi" },
      },
    },
  };
  const name = workloadName(resource);

  return [
    ...workloadObjects(statefulResource, context, "database"),
    {
      apiVersion: "v1",
      kind: "Service",
      metadata: metadata(resource, context, name, "service"),
      spec: {
        type: "ClusterIP",
        selector: workloadSelector(resource, context),
        ports: [{ name: engine, port, targetPort: port, protocol: "TCP" }],
      },
    },
    pvcObject(resource, context, "data", stringValue(resource.config.storage) || "20Gi"),
  ];
}

function workloadContainer(
  resource: Resource,
  context: KubernetesMappingContext,
  component: string,
  port: number,
  includeProbes = true
): Record<string, unknown> {
  const config = resource.config;
  const configMap = configMapObject(resource, context);
  const secretRefs = secretEnvVars(resource);
  const probeConfig = recordValue(config.probes) || {};
  const probesEnabled = includeProbes && config.probes !== false;

  return compactObject({
    name: component,
    image: imageForResource(resource, context),
    imagePullPolicy: stringValue(config.imagePullPolicy) || "IfNotPresent",
    ports: [{ name: "http", containerPort: port, protocol: "TCP" }],
    env: [
      { name: "NOVA_RESOURCE_NAME", value: resource.name },
      { name: "NOVA_RESOURCE_TYPE", value: resource.type },
      ...secretRefs,
    ],
    envFrom: configMap ? [{ configMapRef: { name: configMap.metadata.name } }] : undefined,
    command: arrayValue(config.command),
    args: arrayValue(config.args),
    workingDir: stringValue(config.workingDir),
    resources: resourceRequirements(config),
    securityContext: {
      runAsNonRoot: true,
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: readNested(config, "securityContext.readOnlyRootFilesystem") !== false,
      capabilities: { drop: ["ALL"] },
    },
    volumeMounts: [{ name: "tmp", mountPath: "/tmp" }],
    readinessProbe: probesEnabled ? probe("readiness", port, probeConfig) : undefined,
    livenessProbe: probesEnabled ? probe("liveness", port, probeConfig) : undefined,
    startupProbe: probesEnabled ? probe("startup", port, probeConfig) : undefined,
  });
}

function namespaceObject(namespace: string, context: KubernetesMappingContext): KubernetesManifest {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: namespace,
      labels: baseLabels(context, "namespace", "namespace"),
      annotations: baseAnnotations(context, "namespace", "namespace"),
    },
  };
}

function configMapObject(resource: Resource, context: KubernetesMappingContext): KubernetesManifest | undefined {
  const env = recordValue(resource.config.environment) || recordValue(resource.config.env);
  if (!env) return undefined;

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      data[key] = String(value);
    }
  }

  if (Object.keys(data).length === 0) return undefined;

  const name = `${workloadName(resource)}-env`;
  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: metadata(resource, context, name, "config"),
    data,
  };
}

function secretObject(resource: Resource, context: KubernetesMappingContext): KubernetesManifest {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: metadata(resource, context, sanitizeKubernetesName(resource.name), "secret"),
    type: "Opaque",
    immutable: resource.config.immutable ?? true,
  };
}

function pvcObject(
  resource: Resource,
  context: KubernetesMappingContext,
  suffix?: string,
  defaultSize = "10Gi"
): KubernetesManifest {
  const name = suffix ? `${workloadName(resource)}-${suffix}` : workloadName(resource);
  const accessModes = arrayValue(resource.config.accessModes) || ["ReadWriteOnce"];
  return {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: metadata(resource, context, name, "storage"),
    spec: compactObject({
      accessModes,
      storageClassName: stringValue(resource.config.storageClassName),
      resources: {
        requests: {
          storage: stringValue(resource.config.size) || stringValue(resource.config.storage) || defaultSize,
        },
      },
    }),
  };
}

function serviceAccountObject(
  resource: Resource,
  context: KubernetesMappingContext,
  serviceAccountName: string
): KubernetesManifest {
  return {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: metadata(resource, context, serviceAccountName, "service-account"),
    automountServiceAccountToken: false,
  };
}

function roleObject(resource: Resource, context: KubernetesMappingContext, rules: unknown[]): KubernetesManifest {
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: metadata(resource, context, workloadName(resource), "role"),
    rules,
  };
}

function roleBindingObject(
  resource: Resource,
  context: KubernetesMappingContext,
  serviceAccountName: string
): KubernetesManifest {
  const name = workloadName(resource);
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: metadata(resource, context, name, "role-binding"),
    subjects: [
      {
        kind: "ServiceAccount",
        name: serviceAccountName,
        namespace: context.namespace,
      },
    ],
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "Role",
      name,
    },
  };
}

function podDisruptionBudgetObject(resource: Resource, context: KubernetesMappingContext, replicas: number): KubernetesManifest {
  return {
    apiVersion: "policy/v1",
    kind: "PodDisruptionBudget",
    metadata: metadata(resource, context, workloadName(resource), "availability"),
    spec: {
      minAvailable: numberValue(readNested(resource.config, "pdb.minAvailable"), replicas > 2 ? 2 : 1),
      selector: { matchLabels: workloadSelector(resource, context) },
    },
  };
}

function hpaObject(
  resource: Resource,
  context: KubernetesMappingContext,
  minReplicas: number,
  maxReplicas: number
): KubernetesManifest {
  const scaling = recordValue(resource.config.scaling) || {};
  const metrics: unknown[] = [];
  const cpu = numberValue(scaling.cpu, 70);
  const memory = numberValue(scaling.memory, undefined);

  if (cpu) {
    metrics.push({
      type: "Resource",
      resource: {
        name: "cpu",
        target: { type: "Utilization", averageUtilization: cpu },
      },
    });
  }
  if (memory) {
    metrics.push({
      type: "Resource",
      resource: {
        name: "memory",
        target: { type: "Utilization", averageUtilization: memory },
      },
    });
  }

  return {
    apiVersion: "autoscaling/v2",
    kind: "HorizontalPodAutoscaler",
    metadata: metadata(resource, context, workloadName(resource), "autoscaling"),
    spec: {
      scaleTargetRef: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: workloadName(resource),
      },
      minReplicas,
      maxReplicas,
      metrics,
      behavior: readNested(resource.config, "scaling.behavior"),
    },
  };
}

function networkPolicyObject(resource: Resource, context: KubernetesMappingContext, port: number): KubernetesManifest {
  const np = recordValue(resource.config.networkPolicy) || recordValue(readNested(resource.config, "kubernetes.networkPolicy")) || {};
  const ingressFrom = arrayValue(np.ingressFrom) || [{ podSelector: {} }];
  const egress = arrayValue(np.egress) || [
    {
      to: [{ namespaceSelector: {} }],
    },
  ];

  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "NetworkPolicy",
    metadata: metadata(resource, context, workloadName(resource), "network-policy"),
    spec: {
      podSelector: { matchLabels: workloadSelector(resource, context) },
      policyTypes: ["Ingress", "Egress"],
      ingress: [
        {
          from: ingressFrom,
          ports: [{ protocol: "TCP", port }],
        },
      ],
      egress,
    },
  };
}

function metadata(
  resource: Resource,
  context: KubernetesMappingContext,
  name: string,
  component: string,
  labels: Record<string, string> = {},
  annotations: Record<string, string> = {}
): KubernetesManifest["metadata"] {
  return {
    name,
    namespace: context.namespace,
    labels: {
      ...baseLabels(context, resource.name, component),
      "app.kubernetes.io/component": sanitizeLabelValue(component),
      "novaserve.cloud/resource": sanitizeLabelValue(`${resource.type}-${resource.name}`),
      ...labels,
    },
    annotations: {
      ...baseAnnotations(context, resource.type, resource.name),
      "novaserve.cloud/resource-type": resource.type,
      "novaserve.cloud/resource-name": resource.name,
      "novaserve.cloud/config-hash": resourceConfigHash(resource),
      "novaserve.cloud/object-hash": objectHash({ type: resource.type, name: resource.name, config: resource.config, component }),
      ...annotations,
    },
  };
}

function baseLabels(context: KubernetesMappingContext, name: string, component: string): Record<string, string> {
  return {
    [MANAGED_BY_LABEL]: MANAGED_BY_VALUE,
    "app.kubernetes.io/name": sanitizeLabelValue(context.appName),
    "app.kubernetes.io/instance": sanitizeLabelValue(`${context.appName}-${context.environment}`),
    "app.kubernetes.io/part-of": sanitizeLabelValue(context.appName),
    "app.kubernetes.io/component": sanitizeLabelValue(component),
    "novaserve.cloud/app": sanitizeLabelValue(context.appName),
    "novaserve.cloud/environment": sanitizeLabelValue(context.environment),
    "novaserve.cloud/resource": sanitizeLabelValue(name),
  };
}

function baseAnnotations(context: KubernetesMappingContext, type: string, name: string): Record<string, string> {
  return compactRecord({
    "novaserve.cloud/app": context.appName,
    "novaserve.cloud/environment": context.environment,
    "novaserve.cloud/resource-id": `${type}-${name}`,
    "novaserve.cloud/ir-hash": context.irHash ? `sha256:${context.irHash}` : undefined,
    "novaserve.cloud/plan-hash": context.planHash ? `sha256:${context.planHash}` : undefined,
    "novaserve.cloud/deployment-id": context.deploymentId,
    "novaserve.cloud/version": context.version,
  });
}

function workloadSelector(resource: Resource, context: KubernetesMappingContext): Record<string, string> {
  return {
    [MANAGED_BY_LABEL]: MANAGED_BY_VALUE,
    "novaserve.cloud/app": sanitizeLabelValue(context.appName),
    "novaserve.cloud/environment": sanitizeLabelValue(context.environment),
    "novaserve.cloud/workload": sanitizeLabelValue(`${resource.type}-${resource.name}`),
  };
}

function workloadName(resource: Resource): string {
  return stringValue(readNested(resource.config, "kubernetes.name"))
    || stringValue(resource.config.name)
    || sanitizeKubernetesName(resource.name);
}

function desiredReplicas(resource: Resource, context: KubernetesMappingContext): number {
  const config = resource.config;
  if (config.singleton === true || readNested(config, "kubernetes.singleton") === true) return 1;

  const scaling = recordValue(config.scaling);
  const explicitReplicas = numberValue(config.replicas, undefined) ?? numberValue(readNested(config, "kubernetes.replicas"), undefined);
  if (explicitReplicas !== undefined) return explicitReplicas;
  if (scaling?.minReplicas !== undefined) return numberValue(scaling.minReplicas, 1);

  return context.environment === "production" && (resource.type === "api" || resource.type === "function") ? 2 : 1;
}

function imageForResource(resource: Resource, context: KubernetesMappingContext): string {
  return stringValue(resource.config.image)
    || stringValue(readNested(resource.config, "container.image"))
    || stringValue(readNested(resource.config, "kubernetes.image"))
    || context.providerConfig.defaultImage
    || "ghcr.io/novaserve/runtime-node:latest";
}

function imagePullSecrets(context: KubernetesMappingContext, config: Record<string, unknown>): Array<{ name: string }> | undefined {
  const secrets = arrayValue(readNested(config, "kubernetes.imagePullSecrets"))
    || context.providerConfig.imagePullSecrets;
  if (!secrets || secrets.length === 0) return undefined;

  return secrets
    .filter((secret): secret is string => typeof secret === "string")
    .map((name) => ({ name }));
}

function secretEnvVars(resource: Resource): Array<Record<string, unknown>> {
  const refs = parseSecretRefs(resource.config.secretRefs) || parseSecretRefs(resource.config.secrets);
  if (!refs) return [];

  return Object.entries(refs).map(([envName, ref]) => ({
    name: envName,
    valueFrom: {
      secretKeyRef: {
        name: sanitizeKubernetesName(ref.name),
        key: ref.key || "value",
        optional: ref.optional || false,
      },
    },
  }));
}

function parseSecretRefs(value: unknown): Record<string, KubernetesSecretRef> | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const refs: Record<string, KubernetesSecretRef> = {};
    for (const item of value) {
      if (typeof item === "string") refs[item] = { name: item, key: "value" };
    }
    return Object.keys(refs).length > 0 ? refs : undefined;
  }
  if (typeof value !== "object") return undefined;

  const refs: Record<string, KubernetesSecretRef> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") {
      refs[key] = { name: raw, key: "value" };
    } else if (raw && typeof raw === "object") {
      const object = raw as Record<string, unknown>;
      const name = stringValue(object.name) || stringValue(object.secretName);
      if (name) {
        refs[key] = {
          name,
          key: stringValue(object.key) || "value",
          optional: Boolean(object.optional),
        };
      }
    }
  }

  return Object.keys(refs).length > 0 ? refs : undefined;
}

function resourceRequirements(config: Record<string, unknown>): Record<string, unknown> {
  const resources = recordValue(config.resources);
  return {
    requests: {
      cpu: stringValue(readNested(resources, "requests.cpu")) || "100m",
      memory: stringValue(readNested(resources, "requests.memory")) || "128Mi",
    },
    limits: {
      cpu: stringValue(readNested(resources, "limits.cpu")) || "500m",
      memory: stringValue(readNested(resources, "limits.memory")) || "512Mi",
    },
  };
}

function probe(kind: "readiness" | "liveness" | "startup", port: number, probeConfig: Record<string, unknown>): Record<string, unknown> {
  const defaults = {
    readiness: { initialDelaySeconds: 5, periodSeconds: 10, timeoutSeconds: 2, failureThreshold: 3 },
    liveness: { initialDelaySeconds: 15, periodSeconds: 20, timeoutSeconds: 2, failureThreshold: 3 },
    startup: { initialDelaySeconds: 0, periodSeconds: 2, timeoutSeconds: 2, failureThreshold: 30 },
  }[kind];

  const override = recordValue(probeConfig[kind]) || {};
  return {
    httpGet: {
      path: stringValue(override.path) || stringValue(probeConfig.path) || "/health",
      port,
    },
    initialDelaySeconds: numberValue(override.initialDelaySeconds, defaults.initialDelaySeconds),
    periodSeconds: numberValue(override.periodSeconds, defaults.periodSeconds),
    timeoutSeconds: numberValue(override.timeoutSeconds, defaults.timeoutSeconds),
    failureThreshold: numberValue(override.failureThreshold, defaults.failureThreshold),
  };
}

function podVolumes(_resource: Resource): Array<Record<string, unknown>> {
  return [{ name: "tmp", emptyDir: {} }];
}

function podAffinity(resource: Resource, context: KubernetesMappingContext): Record<string, unknown> {
  return {
    podAntiAffinity: {
      preferredDuringSchedulingIgnoredDuringExecution: [
        {
          weight: 50,
          podAffinityTerm: {
            labelSelector: { matchLabels: workloadSelector(resource, context) },
            topologyKey: "kubernetes.io/hostname",
          },
        },
      ],
    },
  };
}

function topologySpreadConstraints(resource: Resource, context: KubernetesMappingContext): Array<Record<string, unknown>> {
  return [
    {
      maxSkew: 1,
      topologyKey: "topology.kubernetes.io/zone",
      whenUnsatisfiable: "ScheduleAnyway",
      labelSelector: { matchLabels: workloadSelector(resource, context) },
    },
    {
      maxSkew: 1,
      topologyKey: "kubernetes.io/hostname",
      whenUnsatisfiable: "ScheduleAnyway",
      labelSelector: { matchLabels: workloadSelector(resource, context) },
    },
  ];
}

function ingressTls(host: string, secretName?: string): Array<Record<string, unknown>> | undefined {
  if (!secretName) return undefined;
  return [{ hosts: [host], secretName }];
}

function shouldCreateNetworkPolicy(resource: Resource, context: KubernetesMappingContext): boolean {
  const local = resource.config.networkPolicy ?? readNested(resource.config, "kubernetes.networkPolicy");
  if (typeof local === "boolean") return local;
  if (context.providerConfig.networkPolicy !== undefined) return context.providerConfig.networkPolicy;
  return resource.type === "api" || resource.type === "function";
}

function resourceConfigHash(resource: Resource): string {
  return objectHash(resource.config);
}

function objectHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
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

export function manifestIdentity(object: KubernetesManifest): string {
  return `${object.apiVersion}/${object.kind}/${object.metadata.namespace || "cluster"}/${object.metadata.name}`;
}

export function isNovaManaged(object: KubernetesManifest): boolean {
  return object.metadata.labels?.[MANAGED_BY_LABEL] === MANAGED_BY_VALUE;
}

export function assertNovaOwnership(existing: KubernetesManifest, desired: KubernetesManifest): void {
  if (!isNovaManaged(existing)) {
    throw new Error(
      `Refusing to modify ${manifestIdentity(desired)} because it is not managed by NovaServe.`
    );
  }

  const existingApp = existing.metadata.annotations?.["novaserve.cloud/app"] || existing.metadata.labels?.["novaserve.cloud/app"];
  const desiredApp = desired.metadata.annotations?.["novaserve.cloud/app"] || desired.metadata.labels?.["novaserve.cloud/app"];
  const existingEnv = existing.metadata.annotations?.["novaserve.cloud/environment"] || existing.metadata.labels?.["novaserve.cloud/environment"];
  const desiredEnv = desired.metadata.annotations?.["novaserve.cloud/environment"] || desired.metadata.labels?.["novaserve.cloud/environment"];

  if (existingApp !== desiredApp || existingEnv !== desiredEnv) {
    throw new Error(
      `Refusing to modify ${manifestIdentity(desired)} because ownership metadata does not match the target app/environment.`
    );
  }
}

export function generateManifests(resources: Resource[], namespace = "default"): string {
  return serializeManifests(mapResourcesToKubernetesObjects(resources, namespace));
}

export function serializeManifests(objects: KubernetesManifest[]): string {
  return objects.map((object) => toYaml(object)).join("---\n");
}

function toYaml(value: unknown, indent = 0): string {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]\n";
    return value.map((item) => {
      if (isScalar(item)) return `${pad}- ${formatScalar(item)}\n`;
      return `${pad}- ${toYaml(item, indent + 2).trimStart()}`;
    }).join("");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, objectValue]) => objectValue !== undefined)
      .map(([key, objectValue]) => {
        if (isScalar(objectValue)) return `${pad}${key}: ${formatScalar(objectValue)}\n`;
        if (Array.isArray(objectValue) && objectValue.length === 0) return `${pad}${key}: []\n`;
        return `${pad}${key}:\n${toYaml(objectValue, indent + 2)}`;
      })
      .join("");
  }

  return `${pad}${formatScalar(value as string | number | boolean | null)}\n`;
}

function formatScalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === "") return '""';
  if (/^[A-Za-z0-9_.:/@-]+$/.test(value) && !["true", "false", "null"].includes(value)) return value;
  return JSON.stringify(value);
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function sanitizeKubernetesName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = normalized || "resource";
  if (name.length <= 63) return name;

  const suffix = objectHash(value).slice(0, 8);
  return `${name.slice(0, 54)}-${suffix}`.replace(/-+$/g, "");
}

function sanitizeLabelValue(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  const label = normalized || "resource";
  if (label.length <= 63) return label;

  const suffix = objectHash(value).slice(0, 8);
  return `${label.slice(0, 54)}-${suffix}`.replace(/[^a-z0-9]+$/g, "");
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, objectValue]) => objectValue !== undefined)) as T;
}

function compactRecord(value: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter(([, objectValue]) => objectValue !== undefined)) as Record<string, string>;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown, fallback: number): number;
function numberValue(value: unknown, fallback: number | undefined): number | undefined;
function numberValue(value: unknown, fallback: number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function arrayValue(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function readNested(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
