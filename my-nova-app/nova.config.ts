import { defineApp, api } from "novaserve";

export default defineApp({
  name: "my-nova-app",
  region: "ap-south-1",
  runtime: "node20",

  resources: {
    api: api.create({
      routes: {
        "GET /": "src/handlers/hello.handler",
        "GET /health": "src/handlers/health.handler",
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
        "GET /users/:id": "src/handlers/users.get",
      },
      cors: true,
    }),
  },
});
