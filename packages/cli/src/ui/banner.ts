/**
 * ASCII Art Banner
 *
 * Beautiful terminal branding for NovaServe.
 */

const BANNER = `
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   ◆  N O V A S E R V E                          ║
  ║      Like tsc for your infrastructure            ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
`;

const BANNER_COMPACT = `  ◆ NovaServe v2.2.5`;

let bannerPrinted = false;

/**
 * Print the NovaServe banner (only once per CLI invocation).
 */
export function printBanner(compact = true): void {
  if (bannerPrinted) return;
  bannerPrinted = true;

  if (compact) {
    console.log(`\n${BANNER_COMPACT}\n`);
  } else {
    console.log(BANNER);
  }
}

/**
 * Print a section header.
 */
export function printSection(title: string): void {
  console.log(`\n  ${title}`);
  console.log(`  ${"─".repeat(title.length + 2)}\n`);
}
