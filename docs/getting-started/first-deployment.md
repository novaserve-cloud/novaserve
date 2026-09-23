# First Deployment

Deploying your first NovaServe application to production.

## 1. Configure AWS Credentials

NovaServe integrates directly with standard AWS credential tools:

```bash
# Standard AWS CLI configuration
aws configure
```

Or set environment variables:

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"
```

## 2. Verify Credentials with `nova doctor`

```bash
nova doctor
```

Verify that `AWS Cloud Credentials` returns `✓ pass`.

## 3. Plan Deployment

```bash
nova plan
```

This compiles your `nova.config.ts` into a Nova Intermediate Representation graph, diffs it against active cloud state, and presents:
- Resources to create, update, or replace
- Estimated execution time
- Estimated monthly cost in USD

## 4. Execute Deployment

```bash
nova deploy --env production
```
