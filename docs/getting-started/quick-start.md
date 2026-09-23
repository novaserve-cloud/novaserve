# Quick Start Guide

Get up and running with your first NovaServe serverless API in under 2 minutes.

## 1. Initialize a Project

```bash
npx novaserve@latest init my-api --template basic-api
cd my-api
npm install
```

## 2. Start the Local Development Server

```bash
nova dev
```

The CLI launches an in-process local emulator powered by Hono on `http://localhost:3000`.

## 3. Test the Endpoint

```bash
curl http://localhost:3000/hello
```

Expected response:

```json
{
  "message": "Hello from NovaServe! 🚀",
  "timestamp": "2026-09-23T16:00:00.000Z"
}
```

## 4. Preview the Deployment Plan

Before creating real cloud resources, preview the exact diff and cost calculation:

```bash
nova plan
```

## 5. Deploy to AWS

```bash
nova deploy --provider aws
```
