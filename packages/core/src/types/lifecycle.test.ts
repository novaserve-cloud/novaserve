import { describe, it, expect } from "vitest";
import { RESOURCE_CAPABILITY_MATRIX } from "./lifecycle.js";

describe("Resource Capability Matrix", () => {
  it("defines immutable attributes for key resource types", () => {
    expect(RESOURCE_CAPABILITY_MATRIX.function.immutableAttributes).toContain("architecture");
    expect(RESOURCE_CAPABILITY_MATRIX.database.immutableAttributes).toContain("partitionKey");
    expect(RESOURCE_CAPABILITY_MATRIX.database.immutableAttributes).toContain("sortKey");
    expect(RESOURCE_CAPABILITY_MATRIX.queue.immutableAttributes).toContain("fifoQueue");
    expect(RESOURCE_CAPABILITY_MATRIX.storage.immutableAttributes).toContain("bucketName");
  });

  it("supports create, update, replace, delete, observe across all resources", () => {
    for (const [type, cap] of Object.entries(RESOURCE_CAPABILITY_MATRIX)) {
      expect(cap.create).toBe(true);
      expect(cap.replace).toBe(true);
      expect(cap.delete).toBe(true);
      expect(cap.observe).toBe(true);
    }
  });
});
