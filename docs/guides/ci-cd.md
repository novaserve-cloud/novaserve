# Continuous Integration & Delivery (CI/CD)

Best practices for deploying NovaServe applications through CI/CD pipelines like GitHub Actions.

## Example GitHub Actions Deployment Workflow

```yaml
name: Deploy NovaServe App

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x

      - name: Install dependencies
        run: npm ci

      - name: Run Diagnostics
        run: npx novaserve doctor

      - name: Deploy to AWS
        run: npx novaserve deploy --env production --force
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1
```
