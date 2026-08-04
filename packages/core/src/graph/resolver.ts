/**
 * Topological Resolver
 *
 * Resolves resource deployment order using the dependency graph.
 */

import type { Resource } from "../types/resources.js";
import { DependencyGraph } from "./dependency.js";

export class TopologicalResolver {
  private graph: DependencyGraph;

  constructor() {
    this.graph = new DependencyGraph();
  }

  /**
   * Resolve the deployment order for a set of resources.
   * Returns resources grouped by parallel execution level.
   */
  resolve(resources: Resource[]): Resource[][] {
    this.graph.build(resources);
    return this.graph.getParallelGroups();
  }

  /**
   * Get a flat ordered list of resources.
   */
  resolveFlat(resources: Resource[]): Resource[] {
    this.graph.build(resources);
    return this.graph.getTopologicalOrder();
  }

  /**
   * Get the underlying graph.
   */
  getGraph(): DependencyGraph {
    return this.graph;
  }
}
