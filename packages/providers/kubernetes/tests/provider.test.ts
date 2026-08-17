import { describe, it, expect } from "vitest";
import { KubernetesProvider } from "../src/provider.js";
import type { Resource } from "novaserve-core";
import type { KubernetesClient, KubernetesManifest } from "../src/types.js";

class FakeKubernetesClient implements KubernetesClient {
  applied: KubernetesManifest[] = [];
  deleted: KubernetesManifest[] = [];
  waited: Array<{ namespace: string; name: string }> = [];

  async getStatus(namespace: string) {
    return {
      configured: true,
      context: "test-context",
      cluster: "test-cluster",
      namespace,
      warnings: [],
    };
  }

  async validateAccess() {
    return { valid: true, errors: [], warnings: [] };
  }

  async applyObject(object: KubernetesManifest) {
    this.applied.push(object);
    return { action: "configured" as const, object: `${object.kind}/${object.metadata.name}` };
  }

  async deleteObject(object: KubernetesManifest) {
    this.deleted.push(object);
    return { action: "deleted" as const, object: `${object.kind}/${object.metadata.name}` };
  }

  async waitForDeployment(namespace: string, name: string) {
    this.waited.push({ namespace, name });
  }

  async *getLogs() {
    yield { timestamp: new Date(0), pod: "pod-1", message: "ok" };
  }
}

describe("KubernetesProvider", () => {
  it("should generate plan with create actions for new resources", async () => {
    const provider = new KubernetesProvider();
    await provider.init({ name: "test-app" });

    const resources: Resource[] = [
      {
        type: "api",
        name: "my-api",
        config: {},
        dependencies: [],
      },
    ];

    const plan = await provider.plan(resources, []);

    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].action).toBe("create");
    expect(plan.actions[0].resource.name).toBe("my-api");
  });

  it("should warn about unsupported types during validation", async () => {
    const provider = new KubernetesProvider();
    
    const result = await provider.validate([
      { type: "cdn", name: "my-cdn", config: {}, dependencies: [] }
    ]);

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].resource).toBe("my-cdn");
  });

  it("should validate that workloads use explicit images", async () => {
    const provider = new KubernetesProvider({ client: new FakeKubernetesClient() });
    await provider.init({ name: "test-app", kubernetes: { namespace: "prod" } });

    const result = await provider.validate([
      { type: "function", name: "worker", config: { handler: "src/worker.handler" }, dependencies: [] }
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("explicit container image");
  });

  it("should apply through the Kubernetes API and keep skipped resources in state", async () => {
    const client = new FakeKubernetesClient();
    const provider = new KubernetesProvider({ client });
    await provider.init({ name: "test-app", kubernetes: { namespace: "prod" } });

    const result = await provider.deploy({
      appName: "test-app",
      provider: "kubernetes",
      environment: "production",
      irHash: "a".repeat(64),
      planHash: "b".repeat(64),
      actions: [
        {
          action: "create",
          resource: {
            type: "api",
            name: "api",
            config: { image: "ghcr.io/example/api:v1", routes: { "GET /": "src/index.handler" } },
            dependencies: [],
          },
          reason: "new",
          dependsOn: [],
        },
        {
          action: "skip",
          resource: {
            type: "function",
            name: "worker",
            config: { image: "ghcr.io/example/worker:v1", handler: "src/worker.handler" },
            dependencies: [],
          },
          reason: "same",
          dependsOn: [],
        },
      ],
      summary: { create: 1, update: 0, replace: 0, delete: 0, skip: 1 },
    });

    expect(result.success).toBe(true);
    expect(result.resources.map((resource) => resource.name).sort()).toEqual(["api", "worker"]);
    expect(result.resources[0].providerConfig?.kubernetes).toBeDefined();
    expect(client.applied.some((object) => object.kind === "Deployment" && object.metadata.name === "api")).toBe(true);
    expect(client.applied.some((object) => object.kind === "Deployment" && object.metadata.name === "worker")).toBe(false);
    expect(client.waited.some((item) => item.name === "api")).toBe(true);
    expect(client.waited.some((item) => item.name === "worker")).toBe(false);
  });
});
