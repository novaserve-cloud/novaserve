/**
 * Queue Resource Builder
 *
 * Define message queues with automatic handler binding.
 * Supports SQS, RabbitMQ, and provider-native alternatives.
 */

import type { ResourceDefinition } from "../app.js";

/** Queue configuration */
export interface QueueConfig {
  /** Handler function for processing messages */
  handler: string;
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Processing timeout (e.g., "30s", "5m") */
  timeout?: string;
  /** Batch size for processing (default: 1) */
  batchSize?: number;
  /** FIFO queue (preserves message order) */
  fifo?: boolean;
  /** Dead letter queue for failed messages */
  deadLetterQueue?: boolean;
  /** Visibility timeout in seconds */
  visibilityTimeout?: number;
  /** Message retention period (e.g., "4d", "14d") */
  retention?: string;
  /** Delay before messages become visible (seconds) */
  delay?: number;
  /** Maximum concurrent executions */
  concurrency?: number;
}

/** Resolved queue resource */
export interface QueueResource extends ResourceDefinition {
  readonly _type: "queue";
  readonly _config: QueueConfig & Record<string, unknown>;
}

/**
 * Queue resource builder.
 *
 * @example
 * ```ts
 * // Simple queue
 * queue.create("emails", {
 *   handler: "src/handlers/email.process",
 * })
 *
 * // Configured queue
 * queue.create("orders", {
 *   handler: "src/handlers/orders.process",
 *   retries: 5,
 *   timeout: "60s",
 *   batchSize: 10,
 *   fifo: true,
 *   deadLetterQueue: true,
 * })
 * ```
 */
export const queue = {
  create(name: string, config?: Partial<QueueConfig>): QueueResource {
    if (!name) {
      throw new Error("[NovaServe] Queue name is required");
    }

    const handler = config?.handler || `src/handlers/${name}.process`;

    return {
      _type: "queue",
      _name: name,
      _config: {
        retries: 3,
        timeout: "30s",
        batchSize: 1,
        fifo: false,
        deadLetterQueue: true,
        visibilityTimeout: 60,
        retention: "4d",
        delay: 0,
        ...config,
        handler,
      } as QueueConfig & Record<string, unknown>,
    };
  },
};
