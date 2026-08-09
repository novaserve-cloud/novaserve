/**
 * novaserve-provider-aws
 *
 * Real AWS cloud provider for NovaServe.
 * Deploys actual Lambda, API Gateway, S3, SQS, DynamoDB, and IAM resources.
 */

export { AWSProvider } from "./provider.js";
export { LambdaService } from "./services/lambda.js";
export { IAMService } from "./services/iam.js";
export { ApiGatewayService } from "./services/apigateway.js";
export { S3Service } from "./services/s3.js";
export { SQSService } from "./services/sqs.js";
export { DynamoDBService } from "./services/dynamodb.js";
export { CloudWatchService } from "./services/cloudwatch.js";
