import { describe, it, expect } from "vitest";
import { defineApp, api, storage, queue } from "./index.js";

describe("NovaServe SDK defineApp", () => {
  it("creates a valid app configuration with defined resources", () => {
    const app = defineApp({
      name: "test-app",
      region: "ap-south-1",
      runtime: "node20",
      resources: {
        api: api.create({
          routes: {
            "GET /users": "src/handlers/users.list",
          },
          cors: true,
        }),
        uploads: storage.bucket("user-uploads"),
        emailQueue: queue.create("emails", {
          handler: "src/handlers/email.process",
        }),
      },
    });

    expect(app.name).toBe("test-app");
    expect(app.config.region).toBe("ap-south-1");
    expect(app.config.runtime).toBe("node20");
    expect(app.resources.length).toBe(3);
    expect(app.resources[0]._type).toBe("api");
    expect(app.resources[1]._type).toBe("storage");
    expect(app.resources[2]._type).toBe("queue");
  });
});
