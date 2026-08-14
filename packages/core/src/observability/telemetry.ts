/**
 * OpenTelemetry Observability & Trace Correlation Engine
 *
 * Generates OpenTelemetry-compliant trace IDs, span contexts, and correlates
 * API requests, function executions, database queries, and log streams.
 */

import { randomBytes } from "node:crypto";

export interface NovaSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  resourceId: string;
  kind: "SERVER" | "CLIENT" | "INTERNAL";
  status: "OK" | "ERROR";
  durationMs: number;
  attributes: Record<string, string | number | boolean>;
  timestampIso: string;
}

export interface NovaTraceContext {
  traceId: string;
  appName: string;
  environment: string;
  spans: NovaSpan[];
  totalDurationMs: number;
  hasError: boolean;
}

const MAX_ACTIVE_TRACES = 1000;

export class NovaTelemetry {
  private static activeTraces: Map<string, NovaTraceContext> = new Map();

  /** Generate a new OpenTelemetry-compliant 128-bit trace ID (cryptographically random) */
  public static createTraceId(): string {
    return randomBytes(16).toString("hex");
  }

  /** Evict oldest traces if the map exceeds the max size (prevents memory leak) */
  private static evictIfNeeded(): void {
    if (this.activeTraces.size >= MAX_ACTIVE_TRACES) {
      // Map iteration order is insertion order — delete the oldest entry
      const firstKey = this.activeTraces.keys().next().value;
      if (firstKey !== undefined) {
        this.activeTraces.delete(firstKey);
      }
    }
  }

  /** Start a new trace context */
  public static startTrace(appName: string, environment: string, traceId = this.createTraceId()): NovaTraceContext {
    this.evictIfNeeded();
    const context: NovaTraceContext = {
      traceId,
      appName,
      environment,
      spans: [],
      totalDurationMs: 0,
      hasError: false,
    };
    this.activeTraces.set(traceId, context);
    return context;
  }

  /** Record a span entry under a trace */
  public static recordSpan(
    traceId: string,
    span: Omit<NovaSpan, "traceId" | "spanId" | "timestampIso">
  ): NovaSpan {
    let trace = this.activeTraces.get(traceId);
    if (!trace) {
      trace = this.startTrace("nova-app", "production", traceId);
    }

    const fullSpan: NovaSpan = {
      ...span,
      traceId,
      spanId: `span-${Math.random().toString(36).slice(2, 8)}`,
      timestampIso: new Date().toISOString(),
    };

    trace.spans.push(fullSpan);
    trace.totalDurationMs += fullSpan.durationMs;
    if (fullSpan.status === "ERROR") {
      trace.hasError = true;
    }

    return fullSpan;
  }

  /** Retrieve trace by ID */
  public static getTrace(traceId: string): NovaTraceContext | undefined {
    return this.activeTraces.get(traceId);
  }

  /** List recent traces */
  public static listTraces(limit = 10): NovaTraceContext[] {
    return Array.from(this.activeTraces.values()).slice(-limit).reverse();
  }
}
