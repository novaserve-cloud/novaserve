import type {
  KubernetesAccessReview,
  KubernetesApplyResult,
  KubernetesClient,
  KubernetesClusterStatus,
  KubernetesManifest,
  KubernetesProviderConfig,
} from "./types.js";
import { assertNovaOwnership, isNovaManaged, manifestIdentity } from "./mapper.js";

const APPLY_CONTENT_TYPE = "application/strategic-merge-patch+json";
const CLIENT_MODULE = "@kubernetes/client-node";

interface KubernetesApiClientOptions {
  config: KubernetesProviderConfig;
}

export class KubernetesApiClient implements KubernetesClient {
  private readonly config: KubernetesProviderConfig;
  private k8s: any;
  private kubeConfig: any;
  private objectApi: any;
  private coreApi: any;
  private appsApi: any;
  private authApi: any;
  private versionApi: any;

  constructor(options: KubernetesApiClientOptions) {
    this.config = options.config;
  }

  async getStatus(namespace: string): Promise<KubernetesClusterStatus> {
    const warnings: string[] = [];

    try {
      await this.load();
    } catch (error) {
      return {
        configured: false,
        namespace,
        warnings: [`Unable to load Kubernetes configuration: ${messageFromError(error)}`],
      };
    }

    const context = this.kubeConfig.getCurrentContext?.();
    const cluster = this.kubeConfig.getCurrentCluster?.()?.name;
    let serverVersion: string | undefined;

    try {
      const version = unwrapBody(await callApi(this.versionApi, "getCode", [{}], []));
      if (version?.gitVersion) {
        serverVersion = version.gitVersion;
      }
    } catch (error) {
      warnings.push(`Unable to read Kubernetes server version: ${messageFromError(error)}`);
    }

    if (this.config.expectedContext && context !== this.config.expectedContext) {
      warnings.push(`Current context "${context || "unknown"}" does not match expected context "${this.config.expectedContext}".`);
    }

    if (this.config.expectedCluster && cluster !== this.config.expectedCluster) {
      warnings.push(`Current cluster "${cluster || "unknown"}" does not match expected cluster "${this.config.expectedCluster}".`);
    }

    return {
      configured: Boolean(context),
      context,
      cluster,
      namespace,
      serverVersion,
      warnings,
    };
  }

  async validateAccess(namespace: string): Promise<KubernetesAccessReview> {
    const errors: Array<{ resource: string; message: string }> = [];
    const warnings: Array<{ resource: string; message: string }> = [];

    try {
      await this.load();
    } catch (error) {
      errors.push({ resource: "cluster", message: messageFromError(error) });
      return { valid: false, errors, warnings };
    }

    try {
      await this.readObject({
        apiVersion: "v1",
        kind: "Namespace",
        metadata: { name: namespace },
      });
    } catch (error) {
      if (statusCode(error) !== 404) {
        errors.push({ resource: "namespace", message: `Unable to read namespace "${namespace}": ${messageFromError(error)}` });
      }
    }

    const reviews = [
      { group: "apps", resource: "deployments", verb: "patch" },
      { group: "", resource: "services", verb: "patch" },
      { group: "networking.k8s.io", resource: "ingresses", verb: "patch" },
      { group: "autoscaling", resource: "horizontalpodautoscalers", verb: "patch" },
      { group: "policy", resource: "poddisruptionbudgets", verb: "patch" },
      { group: "", resource: "configmaps", verb: "patch" },
      { group: "", resource: "secrets", verb: "patch" },
      { group: "", resource: "persistentvolumeclaims", verb: "patch" },
    ];

    for (const review of reviews) {
      const allowed = await this.selfSubjectAccessReview(namespace, review.group, review.resource, review.verb);
      if (allowed === false) {
        errors.push({
          resource: review.resource,
          message: `Current Kubernetes identity cannot ${review.verb} ${review.resource} in namespace "${namespace}".`,
        });
      } else if (allowed === undefined) {
        warnings.push({
          resource: review.resource,
          message: `Unable to verify ${review.verb} permission for ${review.resource}; the API server may not allow access reviews.`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async applyObject(object: KubernetesManifest): Promise<KubernetesApplyResult> {
    await this.load();
    const existing = await this.readObject(object);

    if (!existing) {
      await callApi(this.objectApi, "create", [object], [object]);
      return { action: "created", object: manifestIdentity(object) };
    }

    if (object.kind === "Namespace" && !isNovaManaged(existing)) {
      return { action: "skipped", object: manifestIdentity(object) };
    }

    assertNovaOwnership(existing, object);

    const desiredHash = object.metadata.annotations?.["novaserve.cloud/object-hash"];
    const existingHash = existing.metadata.annotations?.["novaserve.cloud/object-hash"];
    if (desiredHash && existingHash === desiredHash) {
      return { action: "unchanged", object: manifestIdentity(object) };
    }

    await callApi(
      this.objectApi,
      "patch",
      [
        object,
        undefined,
        undefined,
        undefined,
        { headers: { "Content-Type": APPLY_CONTENT_TYPE } },
      ],
      [object]
    );

    return { action: "configured", object: manifestIdentity(object) };
  }

  async deleteObject(object: KubernetesManifest): Promise<KubernetesApplyResult> {
    await this.load();
    const existing = await this.readObject(object);
    if (!existing) {
      return { action: "skipped", object: manifestIdentity(object) };
    }

    assertNovaOwnership(existing, object);
    await callApi(this.objectApi, "delete", [object], [object]);
    return { action: "deleted", object: manifestIdentity(object) };
  }

  async waitForDeployment(namespace: string, name: string, timeoutSeconds: number): Promise<void> {
    await this.load();
    const started = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - started < timeoutMs) {
      const deployment = await this.readObject({
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: { name, namespace },
      });

      const specReplicas = Number((deployment?.spec as { replicas?: number } | undefined)?.replicas ?? 1);
      const status = deployment?.status as Record<string, number | undefined> | undefined;
      const observedGeneration = Number(status?.observedGeneration ?? 0);
      const generation = Number(deployment?.metadata?.generation ?? 0);
      const updated = Number(status?.updatedReplicas ?? 0);
      const available = Number(status?.availableReplicas ?? 0);
      const unavailable = Number(status?.unavailableReplicas ?? 0);

      if (observedGeneration >= generation && updated >= specReplicas && available >= specReplicas && unavailable === 0) {
        return;
      }

      await sleep(2000);
    }

    throw new Error(`Deployment "${name}" did not become healthy in namespace "${namespace}" within ${timeoutSeconds}s.`);
  }

  async *getLogs(
    namespace: string,
    selector: Record<string, string>,
    options: { limit?: number; since?: Date; follow?: boolean } = {}
  ): AsyncIterable<{ timestamp: Date; pod: string; message: string }> {
    await this.load();
    const labelSelector = Object.entries(selector).map(([key, value]) => `${key}=${value}`).join(",");
    const podList = unwrapBody(await callApi(
      this.coreApi,
      "listNamespacedPod",
      [{ namespace, labelSelector, limit: options.limit }],
      [namespace, undefined, undefined, undefined, undefined, labelSelector, options.limit]
    ));

    const pods = Array.isArray(podList?.items) ? podList.items : [];
    for (const pod of pods) {
      const podName = pod?.metadata?.name;
      if (!podName) continue;

      const raw = unwrapBody(await callApi(
        this.coreApi,
        "readNamespacedPodLog",
        [{
          name: podName,
          namespace,
          tailLines: options.limit,
          sinceSeconds: options.since ? Math.max(1, Math.floor((Date.now() - options.since.getTime()) / 1000)) : undefined,
          follow: options.follow,
        }],
        [podName, namespace, undefined, undefined, undefined, undefined, options.follow, undefined, undefined, options.limit]
      ));
      const text = typeof raw === "string" ? raw : String(raw || "");
      for (const line of text.split("\n").filter(Boolean)) {
        yield {
          timestamp: extractTimestamp(line) || new Date(),
          pod: podName,
          message: line,
        };
      }
    }
  }

  private async readObject(object: KubernetesManifest): Promise<KubernetesManifest | undefined> {
    try {
      return unwrapBody(await callApi(this.objectApi, "read", [object], [object])) as KubernetesManifest;
    } catch (error) {
      if (statusCode(error) === 404) return undefined;
      throw error;
    }
  }

  private async selfSubjectAccessReview(
    namespace: string,
    group: string,
    resource: string,
    verb: string
  ): Promise<boolean | undefined> {
    if (!this.authApi) return undefined;

    const body = {
      apiVersion: "authorization.k8s.io/v1",
      kind: "SelfSubjectAccessReview",
      spec: {
        resourceAttributes: {
          namespace,
          group,
          resource,
          verb,
        },
      },
    };

    try {
      const result = unwrapBody(await callApi(this.authApi, "createSelfSubjectAccessReview", [{ body }], [body]));
      return Boolean(result?.status?.allowed);
    } catch {
      return undefined;
    }
  }

  private async load(): Promise<void> {
    if (this.kubeConfig) return;

    this.k8s = await import(CLIENT_MODULE);
    this.kubeConfig = new this.k8s.KubeConfig();
    this.kubeConfig.loadFromDefault();

    if (this.config.context) {
      this.kubeConfig.setCurrentContext(this.config.context);
    }

    this.objectApi = this.k8s.KubernetesObjectApi.makeApiClient(this.kubeConfig);
    this.coreApi = this.kubeConfig.makeApiClient(this.k8s.CoreV1Api);
    this.appsApi = this.kubeConfig.makeApiClient(this.k8s.AppsV1Api);
    this.versionApi = this.kubeConfig.makeApiClient(this.k8s.VersionApi);
    this.authApi = this.k8s.AuthorizationV1Api
      ? this.kubeConfig.makeApiClient(this.k8s.AuthorizationV1Api)
      : undefined;

    void this.appsApi;
  }
}

async function callApi(api: any, method: string, objectStyleArgs: unknown[], positionalArgs: unknown[]): Promise<unknown> {
  if (!api || typeof api[method] !== "function") {
    throw new Error(`Kubernetes client does not expose ${method}().`);
  }

  try {
    return await api[method](...objectStyleArgs);
  } catch (firstError) {
    try {
      return await api[method](...positionalArgs);
    } catch (secondError) {
      if (statusCode(firstError) && statusCode(firstError) !== 400) throw firstError;
      throw secondError;
    }
  }
}

function unwrapBody(result: any): any {
  return result?.body ?? result?.response?.body ?? result;
}

function statusCode(error: unknown): number | undefined {
  const err = error as {
    statusCode?: number;
    status?: number;
    code?: number;
    response?: { statusCode?: number; status?: number };
    body?: { code?: number };
  };
  return err?.statusCode || err?.status || err?.code || err?.response?.statusCode || err?.response?.status || err?.body?.code;
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTimestamp(line: string): Date | undefined {
  const first = line.split(/\s+/, 1)[0];
  if (!first) return undefined;
  const date = new Date(first);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
