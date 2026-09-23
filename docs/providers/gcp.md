# GCP Provider (`novaserve-provider-gcp`)

Target adapter for deploying NovaServe applications to Google Cloud Platform.

## Status

**Experimental**

## Supported Primitives

- `function` → Google Cloud Functions (2nd gen)
- `storage` → Google Cloud Storage (GCS)
- `queue` → Google Cloud Pub/Sub

## Configuration

Set GCP project and credentials:

```bash
export GOOGLE_CLOUD_PROJECT="my-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"
```
