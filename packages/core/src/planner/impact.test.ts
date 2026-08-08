import { describe, it, expect } from "vitest";
import { NovaCompiler } from "../compiler/compiler.js";
import { NovaImpactAnalyzer } from "./impact.js";

describe("Nova Impact & Blast-Radius Analyzer", () => {
  it("calculates direct and indirect dependents and risk level when database changes", () => {
    const compileResult = NovaCompiler.compile({
      appName: "impact-app",
      resources: [
        { type: "database", name: "main", config: { engine: "postgres" }, dependencies: [] },
        { type: "function", name: "usersList", config: { memory: 512 }, dependencies: ["database-main"] },
        { type: "function", name: "usersCreate", config: { memory: 512 }, dependencies: ["database-main"] },
        { type: "queue", name: "emails", config: {}, dependencies: ["function-usersCreate"] },
      ],
    });

    const impact = NovaImpactAnalyzer.analyze(compileResult.ir, "database-main");

    expect(impact.targetType).toBe("database");
    expect(impact.riskLevel).toBe("HIGH");
    expect(impact.directDependents.length).toBe(2);
    expect(impact.directDependents).toContain("function-usersList");
    expect(impact.directDependents).toContain("function-usersCreate");
    expect(impact.indirectDependents).toContain("queue-emails");
    expect(impact.totalAffected).toBe(3);
  });
});
