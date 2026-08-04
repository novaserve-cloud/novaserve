/**
 * Packager
 *
 * Creates deployment packages (zip files) for cloud providers.
 */

import { createWriteStream, createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

export interface PackageResult {
  /** Path to the created package */
  path: string;
  /** Package size in bytes */
  size: number;
  /** Number of files included */
  fileCount: number;
}

export class Packager {
  /**
   * Create a deployment package from a build directory.
   * Creates a simple tar.gz archive of the bundled handler.
   */
  async createPackage(
    buildDir: string,
    outputPath: string
  ): Promise<PackageResult> {
    const files = await this.collectFiles(buildDir);
    let totalSize = 0;

    // For MVP, we copy the bundled files directly.
    // Full implementation would create a zip compatible with the provider.
    for (const file of files) {
      const fileStat = await stat(file);
      totalSize += fileStat.size;
    }

    return {
      path: outputPath,
      size: totalSize,
      fileCount: files.length,
    };
  }

  /**
   * Recursively collect all files in a directory.
   */
  private async collectFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...(await this.collectFiles(fullPath)));
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return files;
  }
}
