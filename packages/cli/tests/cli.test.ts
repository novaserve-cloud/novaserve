import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync, existsSync, rmSync } from "node:fs";

describe("CLI Integration Tests", () => {
  const cliBin = join(__dirname, "..", "bin", "nova.js");
  const testOutputDir = join(__dirname, "..", "tmp-test-init-api");

  it("reports correct version matching package.json", () => {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf-8")
    );
    const output = execSync(`node ${cliBin} --version`, { encoding: "utf-8" }).trim();
    expect(output).toBe(pkg.version);
  });

  it("outputs comprehensive help screen with registered commands", () => {
    const output = execSync(`node ${cliBin} --help`, { encoding: "utf-8" });
    expect(output).toContain("Usage: nova");
    expect(output).toContain("init");
    expect(output).toContain("dev");
    expect(output).toContain("build");
    expect(output).toContain("plan");
    expect(output).toContain("deploy");
    expect(output).toContain("doctor");
  });

  it("scaffolds a valid new basic-api project with nova init", () => {
    // Clean up previous runs if any
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }

    try {
      execSync(`node ${cliBin} init tmp-test-init-api --template basic-api`, {
        cwd: join(__dirname, ".."),
        encoding: "utf-8",
      });

      expect(existsSync(testOutputDir)).toBe(true);
      expect(existsSync(join(testOutputDir, "package.json"))).toBe(true);
      expect(existsSync(join(testOutputDir, "nova.config.ts"))).toBe(true);
      expect(existsSync(join(testOutputDir, "src", "handlers", "hello.ts"))).toBe(true);

      const generatedPkg = JSON.parse(
        readFileSync(join(testOutputDir, "package.json"), "utf-8")
      );
      expect(generatedPkg.name).toBe("tmp-test-init-api");
      expect(generatedPkg.dependencies.novaserve).toBeDefined();
    } finally {
      if (existsSync(testOutputDir)) {
        rmSync(testOutputDir, { recursive: true, force: true });
      }
    }
  });

  it("executes doctor command diagnostic reporting", () => {
    const output = execSync(`node ${cliBin} doctor`, {
      encoding: "utf-8",
    });
    expect(output).toContain("NovaServe Doctor Diagnostics");
    expect(output).toContain("Diagnostic Summary");
  });
});
