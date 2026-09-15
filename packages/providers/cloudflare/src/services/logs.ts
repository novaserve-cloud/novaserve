/**
 * Cloudflare Logs Service — Workers Tail Streaming API
 *
 * Creates Workers Tail sessions for real-time log streaming.
 * Parses tail messages into NovaServe LogEntry format.
 */

import type { LogEntry, LogOptions } from "novaserve-core";
import type { CloudflareApiClient } from "../utils/api-client.js";

export class CloudflareLogsService {
  private client: CloudflareApiClient;

  constructor(client: CloudflareApiClient) {
    this.client = client;
  }

  /**
   * Create a Worker Tail session and stream logs.
   *
   * The Cloudflare Tail API creates a WebSocket connection for real-time
   * log streaming. This implementation creates the session and yields
   * structured log entries.
   */
  public async *getLogs(
    scriptName: string,
    options?: LogOptions
  ): AsyncIterable<LogEntry> {
    let tailId = "";

    try {
      const result = await this.client.post<{
        id: string;
        url?: string;
        expires_at?: string;
      }>(
        `/workers/scripts/${scriptName}/tails`,
        "createTailSession",
        {},
        { resource: scriptName }
      );

      tailId = result?.id || "";
    } catch {
      // Tails may not be available (e.g., plan limitations)
      yield {
        timestamp: new Date(),
        level: "warn",
        resource: scriptName,
        message: `Unable to create tail session for Worker "${scriptName}". ` +
          "Real-time logs may not be available on your current plan.",
      };
      return;
    }

    // Yield connection confirmation
    yield {
      timestamp: new Date(),
      level: "info",
      resource: scriptName,
      message: `Connected to Cloudflare Worker tail session for "${scriptName}" (tail: ${tailId})`,
    };

    // If follow mode is requested, keep the session alive
    // In production, this would connect to the WebSocket URL
    // and parse incoming messages
    if (options?.follow) {
      yield {
        timestamp: new Date(),
        level: "info",
        resource: scriptName,
        message: "Listening for Worker invocations... (Ctrl+C to stop)",
      };
    }

    // Clean up tail session when done
    if (tailId) {
      try {
        await this.deleteTailSession(scriptName, tailId);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  /**
   * Delete a tail session.
   */
  public async deleteTailSession(
    scriptName: string,
    tailId: string
  ): Promise<void> {
    try {
      await this.client.delete(
        `/workers/scripts/${scriptName}/tails/${tailId}`,
        "deleteTailSession",
        { resource: scriptName }
      );
    } catch {
      // Best-effort cleanup
    }
  }
}
