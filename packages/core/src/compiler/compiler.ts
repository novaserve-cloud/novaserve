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

export interface CompileResult {
  ir: NovaIRGraph;
  capabilityValidation: ReturnType<typeof validateCapabilities>;
}

/** Compute deterministic SHA256 config hash */
function computeHash(content: unknown): string {
  const jsonStr = JSON.stringify(content, Object.keys(content || {}).sort());
  return createHash("sha256").update(jsonStr).digest("hex").slice(0, 16);
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

export class NovaCompiler {
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
      const configHash = computeHash(r.config);

      irResources[resourceId] = {
        id: resourceId,
        type: irType,
        name: r.name,
        configHash,
        config: r.config,
        dependencies: r.dependencies || [],
        requiredCapabilities: [capName],
      };

      // Add to requested capabilities
      const engine = typeof r.config.engine === "string" ? r.config.engine : undefined;
      requestedCapabilities.push({
        resourceId,
        capability: capName,
        engine,
      });

      // Record graph dependencies
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

    // Validate Capabilities against target provider matrix
    const capValidation = validateCapabilities(requestedCapabilities, targetProvider);

    // Infer least-privilege IAM permissions
    const permissions = generateLeastPrivilegePermissions(irResources, dependencies);

    // Calculate composite graph hash
    const appHash = computeHash({
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

    return {
      ir: irGraph,
      capabilityValidation: capValidation,
    };
  }
}
