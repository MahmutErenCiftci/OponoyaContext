import { describe, expect, it } from "vitest";
import { compileContext, exportTargets, renderExport, stableStringify, type CompileInput } from "../src/index.js";
import { hashCanonical } from "../src/hash.js";

/**
 * Golden fixture covering: global-only slot, project override of recipe/profile/
 * global, AI Decide, Disabled, exact component preference, recipe placeholder,
 * conflict warning, archived attachment and deterministic ordering.
 */
const fixture: CompileInput = {
  project: {
    id: "golden",
    name: "Golden fixture",
    slug: "golden-fixture-00000000",
    description: "Reference project used to pin compiler semantics.",
    productType: "SaaS",
    stage: "mvp",
    platforms: ["web", "mobile"],
    priorities: ["Fast MVP", "Maintainability"],
    rules: ["Prefer boring technology.", "Every API input is validated with Zod."],
  },
  resources: [
    { id: "next", name: "Next.js", type: "framework", sourceUrl: "https://nextjs.org", docsUrl: "https://nextjs.org/docs" },
    { id: "astro", name: "Astro", type: "framework" },
    { id: "redis", name: "Redis", type: "cache" },
    { id: "pg", name: "PostgreSQL", type: "database", description: "Primary relational store." },
    { id: "toggle", name: "Saved Toggle", type: "component", sourceUrl: "https://example.com/components/toggle", installCommand: "npx shadcn add toggle" },
    { id: "old-kit", name: "Old UI kit", type: "ui_library", archivedAt: "2026-01-01T00:00:00.000Z" },
  ],
  attachedResourceIds: ["toggle", "pg", "old-kit", "redis"],
  globalDecisions: [
    { id: "g1", scope: "global", slot: "frontend.framework", mode: "PREFERRED", resourceId: "astro", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "g2", scope: "global", slot: "database.primary", mode: "LOCKED", resourceId: "pg", rationale: "Team standard." },
  ],
  profileDecisions: [
    { id: "p1", scope: "profile", slot: "frontend.framework", mode: "LOCKED", resourceId: "astro", priority: 5, sourceId: "profile-design", sourceName: "Design profile", sourcePriority: 1 },
    { id: "p2", scope: "profile", slot: "frontend.ui.base", mode: "PREFERRED", resourceId: "old-kit", sourceId: "profile-stack", sourceName: "Fast SaaS", sourcePriority: 5 },
    { id: "p3", scope: "profile", slot: "frontend.ui.base", mode: "LOCKED", resourceId: "toggle", priority: 9, sourceId: "profile-design", sourceName: "Design profile", sourcePriority: 1 },
  ],
  recipeDecisions: [{ id: "r1", scope: "recipe", slot: "frontend.framework", mode: "PREFERRED", resourceId: "next" }],
  projectDecisions: [
    { id: "d1", scope: "project", slot: "frontend.framework", mode: "LOCKED", resourceId: "next", rationale: "App Router is required." },
    { id: "d2", scope: "project", slot: "backend.framework", mode: "AI_DECIDE", constraints: { allowed: ["Fastify", "Hono"], notes: "TypeScript only", budget: "low" } },
    { id: "d3", scope: "project", slot: "database.cache", mode: "DISABLED", resourceId: "redis" },
    { id: "d4", scope: "project", slot: "frontend.component.toggle", mode: "PREFERRED", resourceId: "toggle" },
    { id: "d5", scope: "project", slot: "infra.monitoring", mode: "PREFERRED", resourceId: "missing" },
    { id: "d6", scope: "project", slot: "backend.queue", mode: "PREFERRED", resourceId: "redis" },
  ],
};

describe("golden compiler fixture", () => {
  const context = compileContext(fixture);

  it("pins the canonical object", () => {
    expect(context).toMatchSnapshot();
    expect(hashCanonical(context)).toMatchSnapshot();
  });

  it("pins every export adapter", () => {
    for (const target of exportTargets) {
      expect(renderExport(target, context)).toMatchSnapshot(target);
    }
  });

  it("is order-independent and byte-stable", () => {
    const reordered = compileContext({
      ...fixture,
      resources: [...fixture.resources].reverse(),
      attachedResourceIds: [...(fixture.attachedResourceIds ?? [])].reverse(),
      projectDecisions: [...(fixture.projectDecisions ?? [])].reverse(),
      globalDecisions: [...(fixture.globalDecisions ?? [])].reverse(),
    });
    expect(reordered).toEqual(context);
    expect(stableStringify(reordered)).toBe(stableStringify(context));
    expect(hashCanonical(reordered)).toBe(hashCanonical(context));
  });
});
