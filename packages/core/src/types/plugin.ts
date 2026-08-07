import type { NovaApp } from "novaserve-sdk";

export interface NovaPlugin {
  name: string;
  version: string;

  /**
   * Called when the plugin is initialized.
   */
  onInit?: (app: NovaApp) => void | Promise<void>;

  /**
   * Called before the build process starts.
   */
  preBuild?: (app: NovaApp) => void | Promise<void>;

  /**
   * Called after the build process finishes successfully.
   */
  postBuild?: (app: NovaApp, buildResults: Map<string, { size: number; durationMs: number }>) => void | Promise<void>;

  /**
   * Called before deployment begins.
   */
  preDeploy?: (app: NovaApp) => void | Promise<void>;

  /**
   * Called after deployment finishes successfully.
   */
  postDeploy?: (app: NovaApp, deployResult: any) => void | Promise<void>;
}
