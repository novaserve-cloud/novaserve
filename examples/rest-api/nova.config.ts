import { defineApp, api, storage } from "novaserve";

export default defineApp({
  name: "rest-api",
  region: "us-east-1",
  runtime: "node20",

  resources: {
    usersApi: api.create({
      routes: {
        "GET /users": "src/handlers/users.list",
        "POST /users": "src/handlers/users.create",
        "GET /users/:id": "src/handlers/users.getById",
      },
      cors: true,
    }),

    userFiles: storage.bucket("user-documents", {
      maxSize: "10mb",
    }),
  },
});
