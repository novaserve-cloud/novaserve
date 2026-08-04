/**
 * @novaserve/core — Core Engine
 *
 * Config parsing, dependency graph resolution,
 * esbuild bundling, and deployment orchestration.
 */

// Config
export { ConfigParser } from "./config/parser.js";
export { ConfigValidator } from "./config/validator.js";

// Graph
export { DependencyGraph } from "./graph/dependency.js";
export { TopologicalResolver } from "./graph/resolver.js";

// Builder
export { Bundler } from "./builder/bundler.js";
export { Packager } from "./builder/packager.js";

// Deployer
export { DeploymentEngine } from "./deployer/engine.js";
export { InfrastructureDiff } from "./deployer/diff.js";
export { StateManager } from "./deployer/state.js";

// Types
export type {
  Resource,
  ResourceType,
  ResolvedResource,
} from "./types/resources.js";

export { toResource } from "./types/resources.js";

export type { NovaPlugin } from "./types/plugin.js";

export type {
  NovaProvider,
  ProviderStatus,
  DeploymentPlan,
  DeploymentPlanAction,
  DeployResult,
  LogEntry,
  LogOptions,
  InvokeResult,
  ValidationResult,
} from "./types/provider.js";

export type {
  NovaEvent,
  EventType,
  EventHandler,
} from "./types/events.js";
