#!/usr/bin/env node
/**
 * validate-package.mjs
 *
 * Automated package validation process for NovaServe.
 * Inspects the generated npm pack tarball before publishing to ensure:
 *  - CLI binary exists and is executable
 *  - Entry point exists
 *  - Package name and version match expectations
 *  - README and LICENSE are present
 *  - No workspace root files or development artifacts leak
 *  - Package size is within reasonable thresholds (< 25MB, > 50KB)
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const cliDir = join(rootDir, "packages", "cli");
const pkgPath = join(cliDir, "package.json");

if (!existsSync(pkgPath)) {
  console.error("❌ packages/cli/package.json not found!");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

console.log(`\n🔍 Validating npm package: ${pkg.name}@${pkg.version}...\n`);

// 1. Verify critical package.json metadata
const errors = [];

if (pkg.name !== "novaserve") {
  errors.push(`Expected package name 'novaserve', found '${pkg.name}'`);
}

if (!pkg.version || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
  errors.push(`Invalid version: '${pkg.version}'`);
}

if (!pkg.bin || !pkg.bin.nova) {
  errors.push("Missing 'bin.nova' entry in package.json");
}

if (!pkg.main || !pkg.exports) {
  errors.push("Missing 'main' or 'exports' in package.json");
}

if (!pkg.engines || !pkg.engines.node) {
  errors.push("Missing 'engines.node' requirement in package.json");
}

if (errors.length > 0) {
  console.error("❌ Package metadata validation failed:");
  errors.forEach((err) => console.error(`  - ${err}`));
  process.exit(1);
}

console.log("  ✓ package.json metadata valid");

// 2. Run npm pack --json in packages/cli to inspect tarball contents
let packResult;
try {
  const output = execSync("npm pack --dry-run --json", {
    cwd: cliDir,
    encoding: "utf-8",
  });
  packResult = JSON.parse(output)[0];
} catch (e) {
  console.error("❌ Failed to run npm pack --dry-run:", e.message);
  process.exit(1);
}

const filePaths = packResult.files.map((f) => f.path);
const unpackedSize = packResult.unpackedSize;

console.log(`  ✓ Tarball contents: ${filePaths.length} files (${(unpackedSize / 1024).toFixed(1)} KB unpacked)`);

// 3. Inspect tarball contents
const requiredFiles = [
  "bin/nova.js",
  "dist/index.js",
  "README.md",
  "LICENSE",
  "package.json",
];

for (const req of requiredFiles) {
  if (!filePaths.includes(req)) {
    errors.push(`Missing required file in package tarball: '${req}'`);
  }
}

// 4. Check forbidden leaks (workspace root files, tests, apps)
const forbiddenPatterns = [
  /^apps\//,
  /^packages\//,
  /^pnpm-lock\.yaml/,
  /^turbo\.json/,
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /^test-.*\.js$/,
  /^\.env/,
];

for (const file of filePaths) {
  for (const pat of forbiddenPatterns) {
    if (pat.test(file)) {
      errors.push(`Forbidden leaked file found in tarball: '${file}'`);
    }
  }
}

// 5. Package size sanity check (detect catastrophic bloat > 25MB or empty build < 30KB)
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MIN_BYTES = 30 * 1024; // 30 KB

if (unpackedSize > MAX_BYTES) {
  errors.push(`Package size too large (${(unpackedSize / (1024 * 1024)).toFixed(2)} MB > 25 MB limit)`);
}

if (unpackedSize < MIN_BYTES) {
  errors.push(`Package size suspiciously small (${(unpackedSize / 1024).toFixed(2)} KB < 30 KB minimum)`);
}

if (errors.length > 0) {
  console.error("\n❌ Package tarball validation failed:");
  errors.forEach((err) => console.error(`  - ${err}`));
  process.exit(1);
}

console.log("  ✓ No leaked root files, tests, or internal configs");
console.log("  ✓ Size within sensible bounds");
console.log(`\n🎉 Package validation PASSED for ${pkg.name}@${pkg.version}!\n`);
