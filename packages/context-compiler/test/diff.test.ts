import { describe, expect, it } from "vitest";
import { diffContexts } from "../src/diff.js";
import { compileContext, type CompileInput } from "../src/index.js";

const base: CompileInput = {
  project: { id: "p", name: "Atlas", stage: "mvp", platforms: ["web"], priorities: ["Fast MVP"], rules: ["Validate inputs."] },
  resources: [
    { id: "next", name: "Next.js", type: "framework" },
    { id: "astro", name: "Astro", type: "framework" },
    { id: "pg", name: "PostgreSQL", type: "database" },
    { id: "redis", name: "Redis", type: "cache" },
  ],
  attachedResourceIds: ["pg"],
  globalDecisions: [{ id: "g1", scope: "global", slot: "frontend.framework", mode: "PREFERRED", resourceId: "next" }],
  projectDecisions: [{ id: "d1", scope: "project", slot: "database.cache", mode: "PREFERRED", resourceId: "redis" }],
};

describe("diffContexts", () => {
  it("reports no changes for identical contexts", () => {
    const context = compileContext(base);
    const diff = diffContexts(context, compileContext(base));
    expect(diff.unchanged).toBe(true);
    expect(diff.decisions).toEqual([]);
    expect(diff.compilerVersion).toBeNull();
  });

  it("explains decision, resource, rule, warning and brief changes semantically", () => {
    const before = compileContext(base);
    const after = compileContext({
      ...base,
      project: { ...base.project, name: "Atlas Finance", stage: "production", rules: ["Validate inputs.", "No client secrets."] },
      attachedResourceIds: ["pg", "redis"],
      projectDecisions: [
        { id: "d2", scope: "project", slot: "frontend.framework", mode: "LOCKED", resourceId: "astro", rationale: "Content site" },
        { id: "d3", scope: "project", slot: "database.cache", mode: "DISABLED", resourceId: "redis" },
        { id: "d4", scope: "project", slot: "backend.framework", mode: "AI_DECIDE", constraints: { allowed: ["Fastify"] } },
      ],
      compatibilityRules: [{ id: "r1", kind: "requires", leftResourceId: "astro", rightResourceId: "next", note: "Islands need the React adapter." }],
    });
    const diff = diffContexts(before, after);
    expect(diff.unchanged).toBe(false);
    expect(diff.project).toEqual([
      { field: "name", before: "Atlas", after: "Atlas Finance" },
      { field: "stage", before: "mvp", after: "production" },
    ]);
    expect(diff.decisions.map((change) => [change.slot, change.kind, change.fields])).toEqual([
      ["backend.framework", "added", []],
      ["database.cache", "changed", ["mode"]],
      ["frontend.framework", "changed", ["mode", "resource", "source", "rationale"]],
    ]);
    expect(diff.resources.added.map((resource) => resource.id)).toEqual(["astro"]);
    expect(diff.resources.removed.map((resource) => resource.id)).toEqual(["next", "redis"]);
    expect(diff.rules).toEqual({ added: ["No client secrets."], removed: [] });
    expect(diff.warnings.added.map((warning) => warning.code)).toEqual(["DISABLED_RESOURCE_ATTACHED", "MISSING_REQUIREMENT"]);
    expect(diff.warnings.removed).toEqual([]);
  });

  it("evaluates curated compatibility rules without touching decisions", () => {
    const context = compileContext({
      ...base,
      compatibilityRules: [
        { id: "conflict", kind: "conflicts", leftResourceId: "redis", rightResourceId: "pg", note: "Team decided against a second store." },
        { id: "requires-ok", kind: "requires", leftResourceId: "next", rightResourceId: "pg" },
        { id: "inactive-left", kind: "conflicts", leftResourceId: "astro", rightResourceId: "next" },
      ],
    });
    expect(context.warnings.map((warning) => warning.code)).toEqual(["RULE_CONFLICT"]);
    expect(context.warnings[0]?.message).toContain("Redis conflicts with PostgreSQL");
    expect(context.warnings[0]?.message).toContain("Team decided against a second store.");
    expect(context.decisions.map((decision) => [decision.slot, decision.mode])).toEqual([["database.cache", "PREFERRED"], ["frontend.framework", "PREFERRED"]]);
    expect(context.resources.map((resource) => resource.id)).toEqual(["next", "pg", "redis"]);
  });
});
