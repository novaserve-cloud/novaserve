/**
 * .dockerignore Generator
 *
 * Generates a production .dockerignore to exclude unnecessary files
 * from Docker build context, reducing image size and preventing
 * accidental inclusion of secrets or development artifacts.
 */

/**
 * Generate a production .dockerignore file.
 */
export function generateDockerignore(): string {
  const lines = [
    "# ── Version Control ───────────────────────────────────",
    ".git",
    ".gitignore",
    ".gitattributes",
    "",
    "# ── NovaServe Build Artifacts ─────────────────────────",
    ".nova",
    ".turbo",
    "",
    "# ── Dependencies ─────────────────────────────────────",
    "node_modules",
    ".pnpm-store",
    "",
    "# ── Docker ───────────────────────────────────────────",
    "Dockerfile",
    "Dockerfile.*",
    "docker-compose*.yml",
    "compose*.yaml",
    ".dockerignore",
    "",
    "# ── Environment & Secrets ────────────────────────────",
    ".env",
    ".env.*",
    "!.env.example",
    "*.pem",
    "*.key",
    "*.crt",
    "",
    "# ── Tests ────────────────────────────────────────────",
    "**/*.test.ts",
    "**/*.test.js",
    "**/*.spec.ts",
    "**/*.spec.js",
    "**/__tests__",
    "**/__mocks__",
    "coverage",
    ".nyc_output",
    "",
    "# ── IDE & Editor ─────────────────────────────────────",
    ".vscode",
    ".idea",
    "*.swp",
    "*.swo",
    ".DS_Store",
    "Thumbs.db",
    "",
    "# ── Documentation ────────────────────────────────────",
    "*.md",
    "!README.md",
    "docs",
    "LICENSE",
    "NOTICE",
    "SECURITY.md",
    "CHANGELOG.md",
    "",
    "# ── Build Outputs ────────────────────────────────────",
    "dist",
    "build",
    "out",
    "",
    "# ── Misc ─────────────────────────────────────────────",
    "*.log",
    "npm-debug.log*",
    "yarn-debug.log*",
    "pnpm-debug.log*",
    ".eslintrc*",
    ".prettierrc*",
    "tsconfig.*.json",
    "vitest.config.*",
    "jest.config.*",
    "",
  ];

  return lines.join("\n");
}
