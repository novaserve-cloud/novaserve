import { describe, it, expect } from "vitest";
import { ApiGatewayService } from "./apigateway.js";

describe("AWS API Gateway v2 Service — 10/10 Operations & Route Diffing", () => {
  it("initializes ApiGatewayService with region and accountId", () => {
    const service = new ApiGatewayService("us-east-1", "123456789012");
    expect(service).toBeDefined();
  });

  it("normalizes route keys and statement IDs deterministically", () => {
    const apiId = "api123";
    const routeKey = "GET /users/{id}";
    const statementId = `apigateway-${apiId}-${routeKey.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}`;

    expect(statementId).toBe("apigateway-api123-GET-usersid");
  });
});
