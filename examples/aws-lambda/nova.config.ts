import { defineApp, api, storage, queue } from "novaserve";

export default defineApp({
  name: "aws-lambda-service",
  region: "us-east-1",
  runtime: "node20",

  resources: {
    // API Gateway v2 HTTP API
    httpApi: api.create({
      routes: {
        "GET /order": "src/handlers/order.status",
        "POST /order": "src/handlers/order.submit",
      },
      cors: true,
    }),

    // SQS Queue for asynchronous background processing
    orderQueue: queue.create("order-processing-queue", {
      retries: 3,
    }),

    // S3 Object Storage for order receipts
    receiptsBucket: storage.bucket("customer-order-receipts", {
      maxSize: "5mb",
    }),
  },
});
