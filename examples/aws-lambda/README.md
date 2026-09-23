# AWS Lambda & API Gateway Example — NovaServe

Demonstrates deploying serverless functions, an API Gateway HTTP endpoint, SQS queue, and S3 bucket to Amazon Web Services using NovaServe.

## Prerequisites

To deploy to real AWS infrastructure, ensure you have configured valid credentials.

### Required AWS Credentials

Configure your AWS credentials using any standard method:

1. **AWS CLI Configuration**:
   ```bash
   aws configure
   ```

2. **Environment Variables**:
   ```bash
   export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
   export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
   export AWS_REGION="us-east-1"
   ```

3. **Named AWS Profile**:
   ```bash
   export AWS_PROFILE="my-production-profile"
   ```

> ⚠️ **Security Reminder**: Never commit AWS secret keys or `.env` files with credentials to git repositories.

## Workflow

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Local Emulator**:
   ```bash
   nova dev
   ```

3. **Check Cloud Environment Readiness**:
   ```bash
   nova doctor
   ```

4. **Preview Infrastructure Plan**:
   ```bash
   nova plan
   ```

5. **Deploy to AWS**:
   ```bash
   nova deploy --provider aws
   ```
