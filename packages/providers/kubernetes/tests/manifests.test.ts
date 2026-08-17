import { describe, it, expect } from "vitest";
import { generateManifests } from "../src/manifests.js";
import type { Resource } from "novaserve-core";

describe("generateManifests", () => {
  it("should generate a deployment and service for an api", () => {
    const resource: Resource = {
      type: "api",
      name: "my-api",
      config: {
        image: "ghcr.io/example/my-api:v1",
        domain: "api.example.com",
        scaling: { minReplicas: 2, maxReplicas: 10, cpu: 70 },
      },
      dependencies: [],
    };

    const yaml = generateManifests([resource], "prod");
    
    expect(yaml).toContain("kind: Namespace");
    expect(yaml).toContain("name: prod");
    expect(yaml).toContain("kind: Deployment");
    expect(yaml).toContain("name: my-api");
    expect(yaml).toContain("image: ghcr.io/example/my-api:v1");
    expect(yaml).toContain("kind: Service");
    expect(yaml).toContain("kind: Ingress");
    expect(yaml).toContain("host: api.example.com");
    expect(yaml).toContain("kind: HorizontalPodAutoscaler");
    expect(yaml).toContain("kind: PodDisruptionBudget");
    expect(yaml).toContain("runAsNonRoot: true");
    expect(yaml).toContain("allowPrivilegeEscalation: false");
    expect(yaml).toContain("readOnlyRootFilesystem: true");
    expect(yaml).toContain("app.kubernetes.io/managed-by: novaserve");
  });

  it("should ignore unsupported types", () => {
    const resource: Resource = {
      type: "cdn",
      name: "my-cdn",
      config: {},
      dependencies: [],
    };

    const yaml = generateManifests([resource], "default");
    
    // Only namespace should be present
    expect(yaml).not.toContain("my-cdn");
  });

  it("should map secrets without plaintext secret values", () => {
    const resource: Resource = {
      type: "secret",
      name: "DATABASE_URL",
      config: { required: true, devDefault: "postgres://localhost/dev" },
      dependencies: [],
    };

    const yaml = generateManifests([resource], "prod");

    expect(yaml).toContain("kind: Secret");
    expect(yaml).toContain("name: database-url");
    expect(yaml).not.toContain("stringData");
    expect(yaml).not.toContain("postgres://localhost/dev");
  });
});
