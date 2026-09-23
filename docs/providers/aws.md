# AWS Provider (`novaserve-provider-aws`)

The primary production provider for NovaServe. Deploys real AWS cloud primitives.

## Status

**Production Ready**

## Supported Primitives

| Resource Type | AWS Service | Details |
|---|---|---|
| `api` | Amazon API Gateway v2 | HTTP APIs with CORS, routes, Lambda integrations |
| `function` | AWS Lambda | Node.js 20.x execution with auto IAM execution roles |
| `storage` | Amazon S3 | Versioned or public object storage buckets |
| `queue` | Amazon SQS | Standard and FIFO message queues |
| `database` | Amazon DynamoDB | Key-value and document tables |
| `cron` | Amazon EventBridge | Scheduled cron triggers targeting Lambda functions |

## Credentials

The AWS Provider uses standard AWS credential chains:
- Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- Shared credentials file: `~/.aws/credentials`
- AWS Profile: `AWS_PROFILE`
- IAM Roles attached to EC2 instances or ECS tasks
