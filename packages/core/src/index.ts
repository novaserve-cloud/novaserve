/**
 * novaserve-core — Core Engine
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

// Nova IR & Compiler
export { NovaCompiler } from "./compiler/compiler.js";
export { validateCapabilities, KNOWN_PROVIDER_CAPABILITIES } from "./compiler/capabilities.js";
export type { CapabilityName, CapabilityCheckResult } from "./compiler/capabilities.js";
export { generateLeastPrivilegePermissions } from "./compiler/iam.js";
export type {
  NovaIRGraph,
  NovaIRResource,
  NovaIRResourceType,
  NovaIRPermission,
  NovaIROutput,
} from "./ir/schema.js";

// Planner & Diff
export { NovaPlanner } from "./deployer/planner.js";
export type { NovaPlanResult, NovaPlanAction, ResourceDiffItem } from "./deployer/planner.js";
export { NovaImpactAnalyzer } from "./planner/impact.js";
export type { ImpactAnalysisResult } from "./planner/impact.js";

// Intelligence & Diagnostics
export { NovaSecurityScanner } from "./security/scanner.js";
export type { SecurityReport, SecurityFinding, SecuritySeverity } from "./security/scanner.js";
export { NovaDoctorEngine } from "./doctor/engine.js";
export type { DoctorReport, DoctorCheckItem } from "./doctor/engine.js";
export { NovaCostEstimator } from "./cost/estimator.js";
export type { CostEstimateReport, ResourceCostItem } from "./cost/estimator.js";

// Events & Replay
export { NovaEventBus } from "./events/bus.js";
export type { RecordedEvent } from "./events/bus.js";

// Drift & Plugins
export { NovaDriftEngine } from "./deployer/drift.js";
export type { DriftReport, DriftItem } from "./deployer/drift.js";
export { NovaPluginManager } from "./plugins/manager.js";
export type { NovaPluginPackage, PluginCapability } from "./plugins/manager.js";

// Journal & Telemetry
export { DeploymentJournal } from "./deployer/journal.js";
export type { ExecutionState, JournalEntry, DeploymentJournalRecord } from "./deployer/journal.js";
export { NovaTelemetry } from "./observability/telemetry.js";
export type { NovaSpan, NovaTraceContext } from "./observability/telemetry.js";



