/**
 * Logger
 *
 * Consistent, color-coded logging for the CLI.
 */

const PREFIX = "  ";

export const logger = {
  info(message: string): void {
    console.log(`${PREFIX}ℹ ${message}`);
  },

  success(message: string): void {
    console.log(`${PREFIX}✓ ${message}`);
  },

  warn(message: string): void {
    console.log(`${PREFIX}⚠ ${message}`);
  },

  error(message: string): void {
    console.error(`${PREFIX}✗ ${message}`);
  },

  debug(message: string): void {
    if (process.env.NOVA_DEBUG) {
      console.log(`${PREFIX}⊙ ${message}`);
    }
  },

  /** Print a blank line */
  blank(): void {
    console.log();
  },

  /** Print a key-value pair */
  kv(key: string, value: string): void {
    console.log(`${PREFIX}  ${key.padEnd(15)} ${value}`);
  },

  /** Print a box with content */
  box(lines: Array<{ key: string; value: string }>): void {
    const maxKeyLen = Math.max(...lines.map((l) => l.key.length));
    const maxValLen = Math.max(...lines.map((l) => l.value.length));
    const width = maxKeyLen + maxValLen + 7;

    console.log(`${PREFIX}┌${"─".repeat(width)}┐`);
    for (const line of lines) {
      const padKey = line.key.padEnd(maxKeyLen);
      const padVal = line.value.padEnd(maxValLen);
      console.log(`${PREFIX}│  ${padKey}  ${padVal}  │`);
    }
    console.log(`${PREFIX}└${"─".repeat(width)}┘`);
  },

  /** Print a diff-style change line */
  diff(action: "+" | "~" | "-" | " ", resource: string, type: string, detail: string): void {
    const icon = action === "+" ? "+" : action === "~" ? "~" : action === "-" ? "-" : " ";
    console.log(`${PREFIX}  ${icon} ${resource.padEnd(22)} ${type.padEnd(14)} (${detail})`);
  },
};
