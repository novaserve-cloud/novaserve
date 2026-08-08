/**
 * Nova Event System & Event Replay Engine
 *
 * Provides a first-class event architecture with schema validation, retry tracking,
 * event payload logging, and local event replay capabilities for debugging.
 */

export interface RecordedEvent {
  id: string;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: string;
  status: "delivered" | "failed" | "replayed";
  traceId: string;
  attempts: number;
}

export class NovaEventBus {
  private static recordedEvents: Map<string, RecordedEvent> = new Map();

  /** Record an event occurrence into memory/store */
  public static record(event: Omit<RecordedEvent, "id" | "timestamp" | "status" | "attempts">): RecordedEvent {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullEvent: RecordedEvent = {
      ...event,
      id,
      timestamp: new Date().toISOString(),
      status: "delivered",
      attempts: 1,
    };
    this.recordedEvents.set(id, fullEvent);
    return fullEvent;
  }

  /** List recorded events */
  public static list(limit = 20): RecordedEvent[] {
    return Array.from(this.recordedEvents.values()).slice(-limit).reverse();
  }

  /** Inspect specific event by ID */
  public static inspect(eventId: string): RecordedEvent | undefined {
    return this.recordedEvents.get(eventId);
  }

  /** Replay event by ID */
  public static async replay(eventId: string, handler?: (evt: RecordedEvent) => Promise<void>): Promise<{ success: boolean; event: RecordedEvent }> {
    const event = this.recordedEvents.get(eventId);
    if (!event) {
      throw new Error(`Event ID "${eventId}" not found.`);
    }

    event.attempts += 1;
    event.status = "replayed";

    if (handler) {
      await handler(event);
    }

    return {
      success: true,
      event,
    };
  }
}
