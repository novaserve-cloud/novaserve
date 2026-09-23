# `nova deploy`

Applies an approved plan to target cloud infrastructure.

## Usage

```bash
nova deploy [options]
```

## Options

- `-e, --env <environment>`: Target environment. Default: `production`.
- `--provider <provider>`: Cloud provider target. Default: `aws`.
- `--plan <filepath>`: Execute pre-approved plan file saved from `nova plan --save`.
- `--dry-run`: Show deployment plan without applying changes.
- `--force`: Skip interactive confirmation prompt.

## AWS Credentials

If deploying to AWS, `nova deploy` verifies caller identity via AWS STS:

```bash
# If credentials are missing:
✗ AWS credentials not found.

NovaServe could not find valid AWS credentials.

Try one of:
  aws configure
  export AWS_PROFILE=my-profile

Run:
  nova doctor
for additional diagnostics.
```
