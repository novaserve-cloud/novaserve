/**
 * AWS Lambda Service — Real Lambda Operations
 *
 * Creates, updates, invokes, and deletes Lambda functions using AWS SDK v3.
 * Handles ZIP packaging, IAM role assignment, configuration updates,
 * ownership tagging, and exponential backoff retry handling.
 */

import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  InvokeCommand,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { awsRetry } from "../utils/retry.js";

export interface LambdaDeployConfig {
  functionName: string;
  roleArn: string;
  handler: string;
  runtime: string;
  memorySize: number;
  timeout: number;
  environment: Record<string, string>;
  /** Path to the bundled code directory */
  codePath: string;
  description?: string;
  appName: string;
  envName?: string;
}

export interface LambdaState {
  functionArn: string;
  functionName: string;
  runtime: string;
  memorySize: number;
  timeout: number;
  handler: string;
  lastModified: string;
  codeSize: number;
  state: string;
}

export class LambdaService {
  private client: LambdaClient;
  private region: string;

  constructor(region: string) {
    this.region = region;
    this.client = new LambdaClient({ region });
  }

  /** Create a new Lambda function from bundled code */
  async createFunction(config: LambdaDeployConfig): Promise<string> {
    const zipBuffer = await this.createZipBuffer(config.codePath);

    const result = await awsRetry(() =>
      this.client.send(
        new CreateFunctionCommand({
          FunctionName: config.functionName,
          Role: config.roleArn,
          Handler: config.handler,
          Runtime: config.runtime as any,
          MemorySize: config.memorySize,
          Timeout: config.timeout,
          Code: { ZipFile: zipBuffer },
          Environment: {
            Variables: config.environment,
          },
          Description: config.description || `NovaServe function: ${config.functionName}`,
          Tags: {
            "novaserve:managed": "true",
            "novaserve:application": config.appName,
            "novaserve:environment": config.envName || "production",
            "novaserve:resource": config.functionName,
            "novaserve:version": "1.0.0",
          },
        })
      )
    );

    // Wait for function to become active
    await waitUntilFunctionActiveV2(
      { client: this.client, maxWaitTime: 60 },
      { FunctionName: config.functionName }
    );

    return result.FunctionArn!;
  }

  /** Update an existing Lambda function's code */
  async updateFunctionCode(functionName: string, codePath: string): Promise<string> {
    const zipBuffer = await this.createZipBuffer(codePath);

    const result = await awsRetry(() =>
      this.client.send(
        new UpdateFunctionCodeCommand({
          FunctionName: functionName,
          ZipFile: zipBuffer,
        })
      )
    );

    await waitUntilFunctionUpdatedV2(
      { client: this.client, maxWaitTime: 60 },
      { FunctionName: functionName }
    );

    return result.FunctionArn!;
  }

  /** Update Lambda configuration (memory, timeout, env vars) */
  async updateFunctionConfiguration(
    functionName: string,
    config: Partial<Pick<LambdaDeployConfig, "memorySize" | "timeout" | "environment" | "description">>
  ): Promise<void> {
    await awsRetry(() =>
      this.client.send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: functionName,
          MemorySize: config.memorySize,
          Timeout: config.timeout,
          Environment: config.environment ? { Variables: config.environment } : undefined,
          Description: config.description,
        })
      )
    );

    await waitUntilFunctionUpdatedV2(
      { client: this.client, maxWaitTime: 60 },
      { FunctionName: functionName }
    );
  }

  /** Delete a Lambda function */
  async deleteFunction(functionName: string): Promise<void> {
    try {
      await awsRetry(() =>
        this.client.send(new DeleteFunctionCommand({ FunctionName: functionName }))
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        return; // Already deleted
      }
      throw err;
    }
  }

  /** Get live Lambda function configuration for drift detection */
  async getFunction(functionName: string): Promise<LambdaState | null> {
    try {
      const result = await awsRetry(() =>
        this.client.send(new GetFunctionCommand({ FunctionName: functionName }))
      );
      const cfg = result.Configuration!;
      return {
        functionArn: cfg.FunctionArn!,
        functionName: cfg.FunctionName!,
        runtime: cfg.Runtime || "nodejs20.x",
        memorySize: cfg.MemorySize || 256,
        timeout: cfg.Timeout || 30,
        handler: cfg.Handler || "index.handler",
        lastModified: cfg.LastModified || "",
        codeSize: cfg.CodeSize || 0,
        state: cfg.State || "Unknown",
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        return null;
      }
      throw err;
    }
  }

  /** Invoke a Lambda function synchronously */
  async invokeFunction(
    functionName: string,
    payload: unknown
  ): Promise<{
    statusCode: number;
    body: unknown;
    durationMs: number;
    logResult?: string;
  }> {
    const start = Date.now();
    const result = await awsRetry(() =>
      this.client.send(
        new InvokeCommand({
          FunctionName: functionName,
          Payload: Buffer.from(JSON.stringify(payload)),
          LogType: "Tail",
        })
      )
    );

    const body = result.Payload
      ? JSON.parse(Buffer.from(result.Payload).toString("utf-8"))
      : null;

    return {
      statusCode: result.StatusCode || 200,
      body,
      durationMs: Date.now() - start,
      logResult: result.LogResult
        ? Buffer.from(result.LogResult, "base64").toString("utf-8")
        : undefined,
    };
  }

  /** Create a ZIP buffer from a code directory */
  private async createZipBuffer(codePath: string): Promise<Buffer> {
    if (codePath.endsWith(".zip")) {
      return readFile(codePath);
    }

    const indexPath = join(codePath, "index.js");
    if (existsSync(indexPath)) {
      const zipPath = join(codePath, "lambda.zip");
      execSync(`cd "${codePath}" && zip -r lambda.zip . -x "*.map"`, { stdio: "pipe" });
      const zipBuffer = await readFile(zipPath);
      return zipBuffer;
    }

    throw new Error(`No deployable code found at ${codePath}`);
  }
}
