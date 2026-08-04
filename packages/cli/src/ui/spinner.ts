/**
 * Spinner Wrapper
 *
 * Beautiful loading spinners for async operations.
 */

/**
 * Create and manage a terminal spinner.
 * Wraps ora for consistent styling.
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>
): Promise<T> {
  // Dynamic import for ESM compatibility
  const { default: ora } = await import("ora");

  const spinner = ora({
    text: message,
    prefixText: "  ",
    color: "cyan",
  }).start();

  try {
    const result = await fn();
    spinner.succeed(message);
    return result;
  } catch (error) {
    spinner.fail(message);
    throw error;
  }
}

/**
 * Create a spinner that can be manually controlled.
 */
export async function createSpinner(message: string) {
  const { default: ora } = await import("ora");

  return ora({
    text: message,
    prefixText: "  ",
    color: "cyan",
  });
}
