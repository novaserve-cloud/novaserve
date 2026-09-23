# Multi-Cloud Deployment Guide

How NovaServe's vendor-neutral intermediate representation enables multi-cloud delivery.

## Concept

Because application handlers and resource declarations compile to **Nova IR (1.0.0)** rather than vendor-specific DSLs, you can target multiple providers without touching your business logic:

```bash
# Develop locally
nova dev

# Deploy to AWS in Production
nova deploy --provider aws --env production

# Containerize for on-premise
nova deploy --provider docker --env staging
```
