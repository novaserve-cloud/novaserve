/**
 * AWS Live State Inspector
 *
 * Inspects actual deployed live infrastructure resources across AWS Lambda,
 * S3, SQS, DynamoDB, API Gateway v2 using AWS SDK v3.
 */

import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { LambdaService } from "./services/lambda.js";
import { S3Service } from "./services/s3.js";
import { SQSService } from "./services/sqs.js";
import { DynamoDBService } from "./services/dynamodb.js";
import { ApiGatewayService } from "./services/apigateway.js";
import { IAMService } from "./services/iam.js";

export interface ObservedResourceState {
  resourceId: string;
  type: string;
  name: string;
  arn?: string;
  status: "deployed" | "missing" | "drifted";
  liveConfig: Record<string, unknown>;
  lastObservedIso: string;
}

export class AWSLiveStateInspector {
  private region: string;
  private appName: string;

  constructor(region: string = "us-east-1", appName: string = "unknown") {
    this.region = region;
    this.appName = appName;
  }

  /** Inspect live AWS state for a set of Nova IR resource IDs */
  public async inspectResources(
    resources: Array<{ id: string; type: string; name: string; config: Record<string, unknown> }>
  ): Promise<Record<string, ObservedResourceState>> {
    const observed: Record<string, ObservedResourceState> = {};
    let accountId = "";

    try {
      const sts = new STSClient({ region: this.region });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      accountId = identity.Account || "";
    } catch {
      // If we don't have AWS credentials, return "missing" for all
      for (const res of resources) {
        observed[res.id] = {
          resourceId: res.id,
          type: res.type,
          name: res.name,
          status: "missing",
          liveConfig: {},
          lastObservedIso: new Date().toISOString(),
        };
      }
      return observed;
    }

    const lambda = new LambdaService(this.region);
    const s3 = new S3Service(this.region);
    const sqs = new SQSService(this.region);
    const dynamodb = new DynamoDBService(this.region);
    const apiGateway = new ApiGatewayService(this.region, accountId);

    for (const res of resources) {
      const resourceName = `${this.appName}-${res.name}`;
      const liveConfig: Record<string, unknown> = {};
      let arn = "";
      let isMissing = false;

      try {
        switch (res.type) {
          case "function": {
            const state = await lambda.getFunction(resourceName);
            if (!state) {
              isMissing = true;
            } else {
              arn = state.functionArn;
              liveConfig.memory = state.memorySize;
              liveConfig.timeout = state.timeout;
              liveConfig.runtime = state.runtime;

              // Inspect IAM Execution Role
              const iam = new IAMService(this.region);
              const roleName = `${this.appName}-${res.name}-role`;
              const roleArn = await iam.getRole(roleName);
              liveConfig.roleArn = roleArn;
              liveConfig.roleExists = Boolean(roleArn);
            }
            break;
          }
          case "storage": {
            const exists = await s3.bucketExists(resourceName);
            if (!exists) {
              isMissing = true;
            } else {
              arn = `arn:aws:s3:::${resourceName}`;
            }
            break;
          }
          case "queue": {
            const url = await sqs.getQueueUrl(resourceName);
            if (!url) {
              isMissing = true;
            } else {
              arn = `arn:aws:sqs:${this.region}:${accountId}:${resourceName}`;
            }
            break;
          }
          case "database": {
            const state = await dynamodb.describeTable(resourceName);
            if (!state) {
              isMissing = true;
            } else {
              arn = state.tableArn;
            }
            break;
          }
          case "api": {
            const apiName = `${this.appName}-api`;
            const state = await apiGateway.findApi(apiName);
            if (!state) {
              isMissing = true;
            } else {
              arn = `arn:aws:apigateway:${this.region}::/apis/${state.ApiId}`;
            }
            break;
          }
        }

        observed[res.id] = {
          resourceId: res.id,
          type: res.type,
          name: res.name,
          arn,
          status: isMissing ? "missing" : "deployed",
          liveConfig,
          lastObservedIso: new Date().toISOString(),
        };
      } catch (e) {
        observed[res.id] = {
          resourceId: res.id,
          type: res.type,
          name: res.name,
          status: "missing",
          liveConfig: {},
          lastObservedIso: new Date().toISOString(),
        };
      }
    }

    return observed;
  }
}
