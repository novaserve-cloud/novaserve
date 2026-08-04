/**
 * Bundler
 *
 * Uses esbuild to bundle Lambda function handlers.
 * Tree-shakes, minifies, and produces optimal bundles.
 */

import { build, type BuildOptions, type BuildResult } from "esbuild";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

export interface BundleOptions {
  /** Path to the handler file */
  entryPoint: string;
  /** Output directory */
  outDir: string;
  /** Output filename */
  outFile?: string;
  /** Target runtime */
  target?: string;
  /** External packages (not bundled) */
  external?: string[];
  /** Enable minification */
  minify?: boolean;
  /** Enable source maps */
  sourcemap?: boolean;
  /** Additional defines */
  define?: Record<string, string>;
}

export interface BundleResult {
  /** Output file path */
  outputPath: string;
  /** Bundle size in bytes */
  size: number;
  /** Build time in ms */
  durationMs: number;
  /** Warnings from esbuild */
  warnings: string[];
}

export class Bundler {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Bundle a single handler function.
   */
  async bundle(options: BundleOptions): Promise<BundleResult> {
    const startTime = Date.now();

    const outDir = join(this.projectRoot, options.outDir);
    await mkdir(outDir, { recursive: true });

    const outFile = options.outFile || "index.js";
    const outputPath = join(outDir, outFile);

    const buildOptions: BuildOptions = {
      entryPoints: [join(this.projectRoot, options.entryPoint)],
      outfile: outputPath,
      bundle: true,
      format: "esm",
      platform: "node",
      target: options.target || "node20",
      minify: options.minify ?? true,
      sourcemap: options.sourcemap ?? true,
      treeShaking: true,
      metafile: true,
      external: [
        // Common AWS SDK packages (available in Lambda runtime)
        "@aws-sdk/*",
        "aws-sdk",
        // User-specified externals
        ...(options.external || []),
      ],
      define: {
        "process.env.NODE_ENV": '"production"',
        ...(options.define || {}),
      },
      logLevel: "warning",
    };

    const result: BuildResult = await build(buildOptions);

    // Calculate bundle size from metafile
    let size = 0;
    if (result.metafile) {
      for (const output of Object.values(result.metafile.outputs)) {
        size += output.bytes;
      }
    }

    const warnings = result.warnings.map((w) => w.text);

    return {
      outputPath,
      size,
      durationMs: Date.now() - startTime,
      warnings,
    };
  }

  /**
   * Bundle multiple handlers in parallel.
   */
  async bundleAll(
    handlers: Array<{ name: string; entryPoint: string }>
  ): Promise<Map<string, BundleResult>> {
    const results = new Map<string, BundleResult>();

    const promises = handlers.map(async ({ name, entryPoint }) => {
      const result = await this.bundle({
        entryPoint,
        outDir: join(".nova", "build", name),
        minify: true,
        sourcemap: true,
      });
      results.set(name, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Format bundle size for display.
   */
  static formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
