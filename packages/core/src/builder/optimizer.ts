/**
 * Bundle Optimizer
 *
 * Analyzes bundles and suggests optimizations.
 */

import type { BundleResult } from "./bundler.js";

export interface OptimizationSuggestion {
  type: "warning" | "info" | "critical";
  message: string;
  recommendation: string;
}

export class BundleOptimizer {
  /** Maximum recommended bundle size in bytes (5 MB) */
  private static MAX_BUNDLE_SIZE = 5 * 1024 * 1024;
  /** Warning threshold (1 MB) */
  private static WARN_BUNDLE_SIZE = 1 * 1024 * 1024;

  /**
   * Analyze a bundle and return optimization suggestions.
   */
  analyze(result: BundleResult): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Bundle size checks
    if (result.size > BundleOptimizer.MAX_BUNDLE_SIZE) {
      suggestions.push({
        type: "critical",
        message: `Bundle size (${formatBytes(result.size)}) exceeds 5 MB limit`,
        recommendation:
          "Consider splitting into smaller functions, adding heavy packages to externals, or using Lambda Layers",
      });
    } else if (result.size > BundleOptimizer.WARN_BUNDLE_SIZE) {
      suggestions.push({
        type: "warning",
        message: `Bundle size (${formatBytes(result.size)}) is over 1 MB`,
        recommendation:
          "Large bundles increase cold start time. Check for unnecessary dependencies.",
      });
    }

    // Build time checks
    if (result.durationMs > 10000) {
      suggestions.push({
        type: "warning",
        message: `Build took ${(result.durationMs / 1000).toFixed(1)}s`,
        recommendation:
          "Slow builds may indicate complex dependency trees. Consider code splitting.",
      });
    }

    // Warnings from esbuild
    for (const warning of result.warnings) {
      suggestions.push({
        type: "info",
        message: warning,
        recommendation: "Review esbuild warning and fix if applicable",
      });
    }

    return suggestions;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
