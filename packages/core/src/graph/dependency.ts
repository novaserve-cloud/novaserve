/**
 * Dependency Graph
 *
 * Builds a DAG (Directed Acyclic Graph) of resources directly from Nova IR
 * to determine deployment order and enable parallel execution.
 */

import type { Resource } from "../types/resources.js";
import type { NovaIRGraph } from "../ir/schema.js";

export interface GraphNode {
  resource: Resource;
  dependencies: Set<string>;
  dependents: Set<string>;
  depth: number;
}

export class DependencyGraph {
  private nodes = new Map<string, GraphNode>();

  /**
   * Build canonical DAG topology directly from Nova IR graph.
   */
  buildFromIR(ir: NovaIRGraph): void {
    const resources: Resource[] = Object.values(ir.resources).map((r) => ({
      type: r.type as any,
      name: r.name,
      config: r.config,
      dependencies: r.dependencies,
    }));
    this.build(resources);
  }

  /**
   * Build the dependency graph from a list of resources.
   */
  build(resources: Resource[]): void {
    this.nodes.clear();

    // Create nodes
    for (const resource of resources) {
      const id = this.resourceId(resource);
      this.nodes.set(id, {
        resource,
        dependencies: new Set(resource.dependencies),
        dependents: new Set(),
        depth: 0,
      });
    }

    // Build reverse edges (dependents)
    for (const [id, node] of this.nodes) {
      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.dependents.add(id);
        }
      }
    }

    // Calculate depths
    this.calculateDepths();

    // Check for cycles
    this.detectCycles();
  }

  /**
   * Get resources that can be deployed in parallel at each level.
   * Returns an array of arrays — each inner array can be executed concurrently.
   */
  getParallelGroups(): Resource[][] {
    const maxDepth = Math.max(0, ...Array.from(this.nodes.values()).map((n) => n.depth));
    const groups: Resource[][] = [];

    for (let depth = 0; depth <= maxDepth; depth++) {
      const group: Resource[] = [];
      for (const node of this.nodes.values()) {
        if (node.depth === depth) {
          group.push(node.resource);
        }
      }
      if (group.length > 0) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Get all resources in topological order.
   */
  getTopologicalOrder(): Resource[] {
    return this.getParallelGroups().flat();
  }

  /**
   * Get direct dependencies of a resource.
   */
  getDependencies(resource: Resource): Resource[] {
    const id = this.resourceId(resource);
    const node = this.nodes.get(id);
    if (!node) return [];

    return Array.from(node.dependencies)
      .map((depId) => this.nodes.get(depId)?.resource)
      .filter((r): r is Resource => r !== undefined);
  }

  /**
   * Get resources that depend on this resource.
   */
  getDependents(resource: Resource): Resource[] {
    const id = this.resourceId(resource);
    const node = this.nodes.get(id);
    if (!node) return [];

    return Array.from(node.dependents)
      .map((depId) => this.nodes.get(depId)?.resource)
      .filter((r): r is Resource => r !== undefined);
  }

  /**
   * Get the total number of resources.
   */
  get size(): number {
    return this.nodes.size;
  }

  // ── Private ──────────────────────────────────────────

  private resourceId(resource: Resource): string {
    return `${resource.type}-${resource.name}`;
  }

  private calculateDepths(): void {
    // Use Kahn's algorithm approach: compute in-degree, process in topological order
    // This correctly handles diamond dependencies by ensuring a node's depth is the
    // maximum depth of ANY of its predecessors + 1 (not just the first one processed).
    const inDegree = new Map<string, number>();

    for (const [id, node] of this.nodes) {
      if (!inDegree.has(id)) inDegree.set(id, 0);
      for (const depId of node.dependencies) {
        inDegree.set(depId, (inDegree.get(depId) ?? 0));
      }
    }

    // Count how many dependencies each node has (in-degree in dependency direction)
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.dependencies.size);
    }

    // Start BFS with nodes that have no dependencies (depth 0)
    const queue: string[] = [];
    for (const [id, node] of this.nodes) {
      node.depth = 0;
      if (node.dependencies.size === 0) {
        queue.push(id);
      }
    }

    // Process nodes in topological order, updating depth to be the maximum
    // of (any predecessor's depth + 1). We use an indegree counter to only
    // enqueue a node once ALL its predecessors have been processed.
    const processedInDegree = new Map<string, number>();
    for (const [id, node] of this.nodes) {
      processedInDegree.set(id, node.dependencies.size);
    }

    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = this.nodes.get(id)!;

      for (const depId of node.dependents) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          // Update depth to be the maximum across all incoming paths
          depNode.depth = Math.max(depNode.depth, node.depth + 1);

          // Only enqueue once all predecessors have been processed
          const remaining = (processedInDegree.get(depId) ?? 1) - 1;
          processedInDegree.set(depId, remaining);
          if (remaining === 0) {
            queue.push(depId);
          }
        }
      }
    }
  }

  private detectCycles(): void {
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (id: string, path: string[]): void => {
      if (inStack.has(id)) {
        const cycleStart = path.indexOf(id);
        const cycle = path.slice(cycleStart).concat(id);
        throw new Error(
          `[NovaServe] Circular dependency detected: ${cycle.join(" → ")}`
        );
      }

      if (visited.has(id)) return;

      visited.add(id);
      inStack.add(id);

      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          dfs(depId, [...path, id]);
        }
      }

      inStack.delete(id);
    };

    for (const id of this.nodes.keys()) {
      dfs(id, []);
    }
  }
}
