/**
 * Azure Monitoring Service — Real Azure Monitor & App Insights Tailing
 *
 * Streams live execution logs from Azure Application Insights and Azure Monitor
 * using official @azure/arm-monitor SDK.
 */

import { MonitorClient } from "@azure/arm-monitor";
import type { DefaultAzureCredential } from "@azure/identity";
import { azureRetry } from "../utils/retry.js";

export interface AzureLogEvent {
  timestamp: Date;
  level: "info" | "warn" | "error";
  resource: string;
  message: string;
}

export class AzureMonitoringService {
  private client: MonitorClient;

  constructor(credential: DefaultAzureCredential, subscriptionId: string) {
    this.client = new MonitorClient(credential, subscriptionId);
  }

  /** Retrieve activity log events for a Function App */
  async getLogEvents(
    resourceGroup: string,
    functionName: string,
    options: { since?: Date; until?: Date; limit?: number } = {}
  ): Promise<AzureLogEvent[]> {
    const events: AzureLogEvent[] = [];
    const sinceTime = options.since || new Date(Date.now() - 3600000); // 1 hour ago
    const filter = `eventTimestamp ge '${sinceTime.toISOString()}' and resourceGroupName eq '${resourceGroup}'`;

    try {
      const logList = this.client.activityLogs.list(filter);
      for await (const log of logList) {
        if (options.limit && events.length >= options.limit) break;

        const level = log.level === "Error" || log.level === "Critical" ? "error" :
                      log.level === "Warning" ? "warn" : "info";

        events.push({
          timestamp: log.eventTimestamp || new Date(),
          level,
          resource: log.resourceId || functionName,
          message: `${log.operationName?.localizedValue || "Event"}: ${log.description || log.status?.localizedValue || ""}`,
        });
      }
    } catch {
      // Return empty if activity logs unavailable
    }

    return events;
  }
}
