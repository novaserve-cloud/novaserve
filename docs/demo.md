# Terminal Demo Walkthrough

This demo walks through the developer workflow from initial scaffolding to previewing an infrastructure plan.

## 1. Project Initialization

```bash
$ npx novaserve@latest init store-api --template basic-api

- Creating store-api...
✔ Created project: store-api

Next steps:
  cd store-api
  npm install
  nova dev        # Start local development
  nova deploy     # Deploy to cloud
```

## 2. Local Development Server

```bash
$ cd store-api
$ npm install
$ nova dev

◆ NovaServe Local Development Server (v2.2.4)
  ⚡ Hono engine listening on http://localhost:3000

  Routes:
    GET  /hello
    GET  /health
    GET  /users
    POST /users
    GET  /users/:id

  [12:00:01] GET /hello 200 OK (2ms)
```

## 3. Querying the Endpoint

```bash
$ curl http://localhost:3000/hello
{"message":"Hello from NovaServe! 🚀","timestamp":"2026-09-23T16:30:00.000Z"}
```

## 4. Previewing Infrastructure Plan

```bash
$ nova plan

◆ NovaServe Deployment Plan

  + function-getUser   (Create, 4s, ~$0.00/mo)
  + storage-receipts   (Create, 3s, ~$0.05/mo)
  + api-httpGateway    (Create, 6s, ~$1.00/mo)

Plan Summary: 3 to add, 0 to change, 0 to destroy.
Estimated Deployment Time: ~13s
Estimated Monthly Cost: $1.05/mo
```
