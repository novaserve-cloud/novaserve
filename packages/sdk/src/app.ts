/**
 * defineApp — The core configuration function for NovaServe.
 *
 * Replaces hundreds of lines of YAML with a single TypeScript expression.
 * Full type-safety, autocompletion, and validation at compile time.
 */

/** Supported serverless runtimes */
export type Runtime =
  | "node18"
  | "node20"
  | "node22"
  | "python3.11"
  | "python3.12"
  | "python3.13"
  | "go1.21"
  | "go1.22"
  | "java17"
  | "java21"
  | "dotnet8"
  | "rust"
  | "bun";

/** Supported cloud regions (common subset) */
export type Region =
  | "us-east-1"
  | "us-east-2"
  | "us-west-1"
  | "us-west-2"
  | "eu-west-1"
  | "eu-west-2"
  | "eu-central-1"
  | "ap-south-1"
  | "ap-southeast-1"
  | "ap-southeast-2"
  | "ap-northeast-1"
  | "ap-northeast-2"
  | "sa-east-1"
  | "ca-central-1"
  | "me-south-1"
  | "af-south-1"
  | (string & {}); // Allow custom regions while providing suggestions

/** Per-environment overrides */
export interface EnvironmentConfig {
  /** Override the default region */
  region?: Region;
  /** Environment-specific variables */
  variables?: Record<string, string>;
  /** Override the default provider */
  provider?: string;
}

/** A resource definition from any resource builder */
export interface ResourceDefinition {
  /** The resource type identifier */
  readonly _type: string;
  /** The resource name */
  readonly _name: string;
  /** Full resource configuration */
  readonly _config: Record<string, unknown>;
  /** Resources this depends on */
  readonly _dependencies?: ResourceDefinition[];
}

/** Application configuration */
export interface NovaAppConfig {
  /** Application name (used as deployment identifier) */
  name: string;

  /** Default deployment region */
  region?: Region;

  /** Default function runtime */
  runtime?: Runtime;

  /** Default memory allocation in MB */
  memory?: number;

  /** Default timeout in seconds */
  timeout?: number;

  /** Default cloud provider */
  provider?: "aws" | "azure" | "gcp" | "cloudflare" | "docker" | "local" | "kubernetes" | "k8s";

  /** Docker-specific configuration */
  docker?: {
    image?: string;
    registry?: {
      url?: string;
      repository?: string;
      tag?: string;
      tagStrategy?: "version" | "git-commit" | "git-tag" | "timestamp" | "custom";
      push?: boolean;
    };
    resources?: {
      limits?: { cpus?: string; memory?: string; pids?: number };
      reservations?: { cpus?: string; memory?: string };
    };
    security?: {
      nonRoot?: boolean;
      user?: string;
      readOnlyRootFilesystem?: boolean;
      dropCapabilities?: boolean;
      noNewPrivileges?: boolean;
      tmpfsMounts?: string[];
      writablePaths?: string[];
    };
    healthCheck?: {
      type?: "http" | "cmd" | "none";
      endpoint?: string;
      command?: string;
      port?: number;
      interval?: number;
      timeout?: number;
      retries?: number;
      startPeriod?: number;
      readinessEndpoint?: string;
      deploymentTimeout?: number;
    };
    build?: {
      context?: string;
      dockerfilePath?: string;
      target?: string;
      args?: Record<string, string>;
      buildKit?: boolean;
      cacheFrom?: string[];
      cacheTo?: string;
      platform?: string;
      sbom?: boolean;
      provenance?: boolean;
    };
    logging?: {
      driver?: string;
      options?: Record<string, string>;
      level?: "debug" | "info" | "warn" | "error";
      structured?: boolean;
    };
    compose?: boolean;
    projectName?: string;
    network?: {
      internal?: boolean;
      public?: boolean;
      networkNames?: { internal?: string; public?: string };
      ipv6?: boolean;
    };
    bundleDependencies?: boolean;
    stopGracePeriod?: number;
    restartPolicy?: "no" | "always" | "on-failure" | "unless-stopped";
    stage?: string;
  };

  /** Kubernetes-specific configuration */
  kubernetes?: {
    context?: string;
    namespace?: string;
    apply?: boolean;
    dryRun?: boolean;
    expectedContext?: string;
    expectedCluster?: string;
    defaultImage?: string;
    imagePullSecrets?: string[];
    ingressClassName?: string;
    tlsSecretName?: string;
    waitForRollout?: boolean;
    rolloutTimeoutSeconds?: number;
    serviceAccountName?: string;
    networkPolicy?: boolean;
  };

  /** Application resources (APIs, functions, storage, etc.) */
  resources?: Record<string, ResourceDefinition>;

  /** Environment-specific configuration */
  environments?: Record<string, EnvironmentConfig>;

  /** Tags applied to all cloud resources */
  tags?: Record<string, string>;
}

/** Resolved application with metadata */
export interface NovaApp {
  /** The raw configuration */
  readonly config: NovaAppConfig;
  /** Resolved resource list */
  readonly resources: ResourceDefinition[];
  /** Application name */
  readonly name: string;
  /** Timestamp of when the config was loaded */
  readonly _loadedAt: number;
}

/**
 * Define a NovaServe application.
 *
 * @example
 * ```ts
 * export default defineApp({
 *   name: "my-api",
 *   region: "ap-south-1",
 *   runtime: "node20",
 *   resources: {
 *     api: api.create({
 *       routes: {
 *         "GET /users": "src/handlers/users.list",
 *         "POST /users": "src/handlers/users.create",
 *       },
 *     }),
 *     uploads: storage.bucket("uploads"),
 *   },
 * });
 * ```
 */
export function defineApp(config: NovaAppConfig): NovaApp {
  // Validate required fields
  if (!config.name) {
    throw new Error("[NovaServe] Application name is required in defineApp()");
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(config.name) && config.name.length > 1) {
    if (!/^[a-z0-9]$/.test(config.name)) {
      throw new Error(
        `[NovaServe] Invalid app name "${config.name}". Use lowercase letters, numbers, and hyphens only.`
      );
    }
  }

  // Collect resources into a flat list
  const resources: ResourceDefinition[] = [];
  if (config.resources) {
    for (const [key, resource] of Object.entries(config.resources)) {
      if (resource && typeof resource === "object" && "_type" in resource) {
        resources.push(resource);
      } else {
        throw new Error(
          `[NovaServe] Invalid resource "${key}". Use resource builders like api.create(), storage.bucket(), etc.`
        );
      }
    }
  }

  // Apply defaults
  const resolvedConfig: NovaAppConfig = {
    region: "us-east-1",
    runtime: "node20",
    memory: 256,
    timeout: 30,
    provider: "aws",
    ...config,
  };

  return {
    config: resolvedConfig,
    resources,
    name: config.name,
    _loadedAt: Date.now(),
  };
}
