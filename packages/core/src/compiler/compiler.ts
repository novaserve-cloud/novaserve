/**
 * Nova Compiler
 *
 * Compiles developer application definitions (TypeScript SDK / NovaAppConfig)
 * into a provider-neutral, versioned, diffable Nova Intermediate Representation (Nova IR).
 */

import { createHash } from "crypto";
import type { NovaIRGraph, NovaIRResource, NovaIRResourceType } from "../ir/schema.js";
import { validateCapabilities, type CapabilityName } from "./capabilities.js";
import { generateLeastPrivilegePermissions } from "./iam.js";
import type { Resource } from "../types/resources.js";

export interface CompileOptions {
  appName: string;
  environment?: string;
  region?: string;
  targetProvider?: string;
  resources: Resource[];
}

export interface IRValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cycleDetected?: string[];
}

export interface CompileResult {
  ir: NovaIRGraph;
  capabilityValidation: ReturnType<typeof validateCapabilities>;
  validation: IRValidationResult;
}

/** Compute deterministic SHA256 config hash with sorted keys */
export function computeCanonicalHash(content: unknown): string {
  const sortedJson = JSON.stringify(content, (key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((acc: Record<string, unknown>, k) => {
          acc[k] = value[k];
          return acc;
        }, {});
    }
    return value;
  });
  return createHash("sha256").update(sortedJson).digest("hex").slice(0, 16);
}

/** Map generic ResourceType to NovaIRResourceType */
function mapResourceType(type: string): NovaIRResourceType {
  switch (type) {
    case "function": return "function";
    case "api": return "api";
    case "storage": return "storage";
    case "queue": return "queue";
    case "database": return "database";
    case "cache": return "cache";
    case "secret": return "secret";
    case "cron": return "cron";
    case "websocket": return "websocket";
    default: return "custom";
  }
}

/** Map ResourceType to CapabilityName */
function mapCapabilityName(type: string): CapabilityName {
  switch (type) {
    case "function": return "compute";
    case "storage": return "storage";
    case "queue": return "queue";
    case "database": return "database";
    case "cache": return "cache";
    case "secret": return "secrets";
    case "cron": return "cron";
    case "websocket": return "websocket";
    default: return "compute";
  }
}

/** Cycle detection algorithm for Nova IR DAG topology */
function detectCycles(resources: Record<string, NovaIRResource>): string[] | null {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  let detectedPath: string[] | null = null;

  function dfs(nodeId: string, path: string[]): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const res = resources[nodeId];
    if (res && res.dependencies) {
      for (const depId of res.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId, path)) return true;
        } else if (recStack.has(depId)) {
          path.push(depId);
          detectedPath = [...path];
          return true;
        }
      }
    }

    recStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const id of Object.keys(resources)) {
    if (!visited.has(id)) {
      if (dfs(id, [])) return detectedPath;
    }
  }

  return null;
}

export class NovaCompiler {
  /** Validate Nova IR Graph for missing dependencies, cycles, and schema rules */
  public static validateIR(ir: NovaIRGraph): IRValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!ir || ir.schemaVersion !== "1.0.0") {
      errors.push("Invalid Nova IR schema version. Required: '1.0.0'");
    }

    const resIds = new Set(Object.keys(ir.resources || {}));

    // Check missing dependencies
    for (const [id, res] of Object.entries(ir.resources || {})) {
      for (const depId of res.dependencies || []) {
        if (!resIds.has(depId)) {
          errors.push(
            `Resource "${res.name}" (${res.type}) references unknown dependency "${depId}". Resource "${depId}" does not exist in the Nova IR graph.`
          );
        }
      }
    }

    // Check circular dependencies
    const cycle = detectCycles(ir.resources || {});
    if (cycle) {
      errors.push(`Circular dependency cycle detected in graph topology: ${cycle.join(" → ")}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cycleDetected: cycle || undefined,
    };
  }

  /** Compile application resources into Nova IR Graph */
  public static compile(options: CompileOptions): CompileResult {
    const environment = options.environment || "development";
    const region = options.region || "ap-south-1";
    const targetProvider = options.targetProvider || "aws";

    const irResources: Record<string, NovaIRResource> = {};
    const dependencies: Array<{ from: string; to: string; type: "link" | "event" | "permission" }> = [];
    const requestedCapabilities: Array<{ resourceId: string; capability: CapabilityName; engine?: string }> = [];

    for (const r of options.resources) {
      const resourceId = `${r.type}-${r.name}`;
      const irType = mapResourceType(r.type);
      const capName = mapCapabilityName(r.type);
      const configHash = computeCanonicalHash(r.config);

      irResources[resourceId] = {
        id: resourceId,
        type: irType,
        name: r.name,
        configHash,
        config: r.config,
        dependencies: r.dependencies || [],
        requiredCapabilities: [capName],
      };

      const engine = typeof r.config.engine === "string" ? r.config.engine : undefined;
      requestedCapabilities.push({
        resourceId,
        capability: capName,
        engine,
      });

      if (r.dependencies && r.dependencies.length > 0) {
        for (const depId of r.dependencies) {
          dependencies.push({
            from: resourceId,
            to: depId,
            type: "link",
          });
        }
      }
    }

    const capValidation = validateCapabilities(requestedCapabilities, targetProvider);
    const permissions = generateLeastPrivilegePermissions(irResources, dependencies);

    const appHash = computeCanonicalHash({
      appName: options.appName,
      environment,
      region,
      resources: irResources,
      dependencies,
    });

    const irGraph: NovaIRGraph = {
      schemaVersion: "1.0.0",
      app: {
        name: options.appName,
        version: "1.0.0",
        environment,
        region,
        hash: appHash,
        createdIso: new Date().toISOString(),
      },
      resources: irResources,
      dependencies,
      capabilitiesRequired: Array.from(new Set(requestedCapabilities.map((c) => c.capability))),
      permissions,
      outputs: {},
    };

    const irValidation = this.validateIR(irGraph);

    return {
      ir: irGraph,
      capabilityValidation: capValidation,
      validation: irValidation,
    };
  }
}
