import { defineApp, api } from "novaserve";

export default defineApp({
  name: "hello-world",
  region: "us-east-1",
  runtime: "node20",

  resources: {
    httpApi: api.create({
      routes: {
        "GET /hello": "src/handlers/hello.handler",
      },
      cors: true,
    }),
  },
});
