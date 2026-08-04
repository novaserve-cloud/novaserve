/**
 * Event System Types
 *
 * Internal event bus for lifecycle hooks and plugin communication.
 */

/** Event types emitted during the NovaServe lifecycle */
export type EventType =
  | "config:loaded"
  | "config:validated"
  | "build:start"
  | "build:complete"
  | "build:error"
  | "deploy:plan"
  | "deploy:start"
  | "deploy:progress"
  | "deploy:complete"
  | "deploy:error"
  | "deploy:rollback"
  | "destroy:start"
  | "destroy:complete"
  | "dev:start"
  | "dev:reload"
  | "dev:request"
  | "resource:creating"
  | "resource:created"
  | "resource:updating"
  | "resource:updated"
  | "resource:deleting"
  | "resource:deleted"
  | "resource:error";

/** Base event interface */
export interface NovaEvent {
  /** Event type */
  type: EventType;
  /** Timestamp */
  timestamp: number;
  /** Event payload */
  data: Record<string, unknown>;
}

/** Event handler function */
export type EventHandler = (event: NovaEvent) => void | Promise<void>;

/**
 * Simple event emitter for NovaServe lifecycle events.
 */
export class NovaEventBus {
  private handlers = new Map<EventType, Set<EventHandler>>();

  /** Register an event handler */
  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** Emit an event to all registered handlers */
  async emit(type: EventType, data: Record<string, unknown> = {}): Promise<void> {
    const event: NovaEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    const handlers = this.handlers.get(type);
    if (!handlers) return;

    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      const result = handler(event);
      if (result instanceof Promise) {
        promises.push(result);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /** Remove all handlers */
  clear(): void {
    this.handlers.clear();
  }
}
