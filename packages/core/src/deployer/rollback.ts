/**
 * Rollback Manager
 *
 * Handles deployment rollbacks to the last known good state.
 */

import type { NovaProvider } from "../types/provider.js";
import type { ResolvedResource } from "../types/resources.js";
import { StateManager } from "./state.js";

export class RollbackManager {
  private stateManager: StateManager;
  private provider: NovaProvider;

  constructor(provider: NovaProvider, projectRoot: string) {
    this.provider = provider;
    this.stateManager = new StateManager(projectRoot);
  }

  /**
   * Rollback to the previous deployment state.
   */
  async rollback(
    appName: string,
    environment: string
  ): Promise<{ success: boolean; message: string }> {
    const previousState = this.stateManager.getPreviousDeployment(
      appName,
      environment
    );

    if (!previousState) {
      return {
        success: false,
        message: "No previous deployment found to rollback to",
      };
    }

    try {
      // Get current resources to destroy new ones
      const currentResources = this.stateManager.getResources(
        appName,
        environment
      );

      // Find resources to remove (exist in current but not in previous)
      const previousIds = new Set(previousState.map((r) => r.id));
      const toRemove = currentResources.filter((r) => !previousIds.has(r.id));

      if (toRemove.length > 0) {
        await this.provider.destroy(toRemove);
      }

      // Restore previous state
      this.stateManager.saveDeployment(
        appName,
        environment,
        this.provider.name,
        previousState
      );

      return {
        success: true,
        message: `Rolled back to previous deployment (${previousState.length} resources)`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
