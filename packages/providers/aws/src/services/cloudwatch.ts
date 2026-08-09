/**
 * AWS CloudWatch Logs Service — Real Log Retrieval
 */

import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  GetLogEventsCommand,
  type FilteredLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";

export interface CloudWatchLogEntry {
  timestamp: Date;
  message: string;
  logStreamName: string;
  eventId: string;
}

export class CloudWatchService {
  private client: CloudWatchLogsClient;

  constructor(region: string) {
    this.client = new CloudWatchLogsClient({ region });
  }

  /**
   * Get recent log events for a Lambda function.
   * Lambda log groups follow the pattern: /aws/lambda/<function-name>
   */
  async getLogEvents(
    functionName: string,
    options: {
      since?: Date;
      until?: Date;
      filterPattern?: string;
      limit?: number;
    } = {}
  ): Promise<CloudWatchLogEntry[]> {
    const logGroupName = `/aws/lambda/${functionName}`;
    const limit = options.limit || 100;

    try {
      const result = await this.client.send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime: options.since?.getTime(),
          endTime: options.until?.getTime(),
          filterPattern: options.filterPattern,
          limit,
        })
      );

      return (result.events || []).map((event: FilteredLogEvent) => ({
        timestamp: new Date(event.timestamp || 0),
        message: (event.message || "").trim(),
        logStreamName: event.logStreamName || "",
        eventId: event.eventId || "",
      }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        return []; // Log group doesn't exist yet
      }
      throw err;
    }
  }
}
