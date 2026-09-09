import { describe, expect, it } from "vitest";
import {
  compileContext,
  renderExport,
  renderGenericMarkdown,
  stableStringify,
  type DecisionInput,
  type ResourceInput,
} from "../src/index.js";
import { hashCanonical } from "../src/hash.js";

const resources: ResourceInput[] = [
  { id: "next", name: "Next.js", type: "framework", sourceUrl: "https://nextjs.org" },
  { id: "astro", name: "Astro", type: "framework" },
  { id: "redis", name: "Redis", type: "cache" },
  { id: "old-kit", name: "Old UI kit", type: "ui_library", archivedAt: "2026-01-01T00:00:00.000Z" },
  {
    id: "animate-toggle",
    name: "Animate UI Toggle",
    type: "component",
    sourceUrl: "https://animate-ui.com/docs/components/radix/toggle",
    installCommand: "npx shadcn add @animate-ui/radix-toggle",
  },
];

const project = { id: "project", name: "Demo" };

describe("compileContext", () => {
  it("lets project scope override recipe, profile and global decisions with full provenance", () => {
    const output = compileContext({
      project,
      resources,
      globalDecisions: [{ id: "g1", scope: "global", slot: "frontend.framework", mode: "PREFERRED", resourceId: "astro" }],
      profileDecisions: [{ id: "p1", scope: "profile", slot: "frontend.framework", mode: "LOCKED", resourceId: "astro", priority: 5 }],
      recipeDecisions: [{ id: "r1", scope: "recipe", slot: "frontend.framework", mode: "PREFERRED", resourceId: "next" }],
      projectDecisions: [{ id: "d1", scope: "project", slot: "frontend.framework", mode: "LOCKED", resourceId: "next" }],
    });
    expect(output.decisions[0]).toMatchObject({ slot: "frontend.framework", source: "project", decisionId: "d1", mode: "LOCKED" });
    expect(output.decisions[0]?.resource?.name).toBe("Next.js");
    expect(output.decisions[0]?.shadowed).toEqual([
      { decisionId: "r1", scope: "recipe", mode: "PREFERRED", resourceId: "next", priority: 0, origin: null },
      { decisionId: "p1", scope: "profile", mode: "LOCKED", resourceId: "astro", priority: 5, origin: null },
      { decisionId: "g1", scope: "global", mode: "PREFERRED", resourceId: "astro", priority: 0, origin: null },
    ]);
    expect(output.resources.map((item) => item.id)).toEqual(["next"]);
    expect(output.resources[0]?.slots).toEqual(["frontend.framework"]);
  });

  it("resolves same-slot Profile conflicts by attachment priority and keeps the Profile name as provenance", () => {
    const output = compileContext({
      project: { ...project, rules: ["Prefer boring technology.", "No client-side secrets."] },
      resources,
      profileDecisions: [
        { id: "p-design", scope: "profile", slot: "frontend.framework", mode: "PREFERRED", resourceId: "astro", priority: 9, sourceId: "design", sourceName: "Design profile", sourcePriority: 1 },
        { id: "p-stack", scope: "profile", slot: "frontend.framework", mode: "LOCKED", resourceId: "next", priority: 0, sourceId: "stack", sourceName: "Fast SaaS", sourcePriority: 5 },
        { id: "p-stack-db", scope: "profile", slot: "database.primary", mode: "PREFERRED", resourceId: "redis", sourceId: "stack", sourceName: "Fast SaaS", sourcePriority: 5 },
      ],
      projectDecisions: [{ id: "d-db", scope: "project", slot: "database.primary", mode: "AI_DECIDE" }],
    });
    const framework = output.decisions.find((decision) => decision.slot === "frontend.framework");
    expect(framework).toMatchObject({ source: "profile", decisionId: "p-stack", origin: { id: "stack", name: "Fast SaaS", priority: 5 } });
    expect(framework?.shadowed).toEqual([{ decisionId: "p-design", scope: "profile", mode: "PREFERRED", resourceId: "astro", priority: 9, origin: { id: "design", name: "Design profile", priority: 1 } }]);
    const database = output.decisions.find((decision) => decision.slot === "database.primary");
    expect(database).toMatchObject({ source: "project", origin: null, shadowed: [{ decisionId: "p-stack-db", origin: { name: "Fast SaaS" } }] });
    expect(output.rules).toEqual(["Prefer boring technology.", "No client-side secrets."]);
    const markdown = renderGenericMarkdown(output);
    expect(markdown).toContain('- Source: profile "Fast SaaS"');
    expect(markdown).toContain('- Overrides: profile "Design profile" PREFERRED');
    expect(markdown).toContain("## Engineering rules");
    expect(markdown).toContain("- No client-side secrets.");
  });

  it("breaks same-scope ties by priority, then newest revision, then id", () => {
    const decisions: DecisionInput[] = [
      { id: "b", scope: "profile", slot: "database.primary", mode: "PREFERRED", resourceId: "astro", priority: 1, updatedAt: "2026-01-01T00:00:00Z" },
      { id: "a", scope: "profile", slot: "database.primary", mode: "LOCKED", resourceId: "next", priority: 1, updatedAt: "2026-02-01T00:00:00Z" },
      { id: "c", scope: "profile", slot: "database.primary", mode: "DISABLED", resourceId: "redis", priority: 9 },
    ];
    const output = compileContext({ project, resources, profileDecisions: decisions });
    expect(output.decisions[0]?.decisionId).toBe("c");
    expect(output.decisions[0]?.shadowed.map((item) => item.decisionId)).toEqual(["a", "b"]);
  });

  it("supports AI_DECIDE without a resource and renders it as a delegation", () => {
    const output = compileContext({
      project,
      resources,
      projectDecisions: [{ id: "d1", scope: "project", slot: "backend.framework", mode: "AI_DECIDE", constraints: { allowed: ["Fastify", "Hono"], notes: "TypeScript only" } }],
    });
    expect(output.decisions[0]).toMatchObject({ mode: "AI_DECIDE", resource: null });
    expect(output.warnings).toEqual([]);
    const markdown = renderGenericMarkdown(output);
    expect(markdown).toContain("## Delegated decisions (AI decides)");
    expect(markdown).toContain("- Allowed options: Fastify, Hono");
    expect(markdown).toContain("- Constraint notes: TypeScript only");
  });

  it("renders disabled technologies as negative instructions outside the active stack", () => {
    const output = compileContext({
      project,
      resources,
      attachedResourceIds: ["redis", "next"],
      projectDecisions: [
        { id: "d1", scope: "project", slot: "database.cache", mode: "DISABLED", resourceId: "redis" },
        { id: "d2", scope: "project", slot: "backend.queue", mode: "PREFERRED", resourceId: "redis" },
      ],
    });
    expect(output.resources.map((item) => item.id)).toEqual(["next"]);
    expect(output.warnings.map((warning) => warning.code)).toEqual(["DISABLED_RESOURCE_ATTACHED", "RESOURCE_CONFLICT"]);
    const markdown = renderGenericMarkdown(output);
    expect(markdown).toContain("## Do not use");
    expect(markdown).toContain("Do not use Redis in this project.");
    expect(markdown).toContain("RESOURCE_CONFLICT: Redis is disabled in database.cache but selected in backend.queue.");
  });

  it("keeps exact component references, warns about archived or missing resources and includes attachments", () => {
    const output = compileContext({
      project,
      resources,
      attachedResourceIds: ["animate-toggle", "ghost"],
      projectDecisions: [
        { id: "d1", scope: "project", slot: "frontend.component.toggle", mode: "PREFERRED", resourceId: "animate-toggle" },
        { id: "d2", scope: "project", slot: "frontend.ui.base", mode: "LOCKED", resourceId: "old-kit" },
        { id: "d3", scope: "project", slot: "infra.monitoring", mode: "PREFERRED", resourceId: "missing" },
      ],
    });
    expect(output.warnings.map((warning) => [warning.code, warning.slot])).toEqual([
      ["RESOURCE_ARCHIVED", "frontend.ui.base"],
      ["RESOURCE_UNRESOLVED", null],
      ["RESOURCE_UNRESOLVED", "infra.monitoring"],
    ]);
    const markdown = renderGenericMarkdown(output);
    expect(markdown).toContain("https://animate-ui.com/docs/components/radix/toggle");
    expect(markdown).toContain("- Install: `npx shadcn add @animate-ui/radix-toggle`");
    expect(markdown).toContain("attached to project · slots: frontend.component.toggle");
    expect(output.resources.find((item) => item.id === "old-kit")?.archived).toBe(true);
  });

  it("is deterministic regardless of input order and hashes byte-stable JSON", () => {
    const input = {
      project: { ...project, priorities: ["Fast MVP", "Maintainability"], platforms: ["web"] },
      resources,
      attachedResourceIds: ["next", "animate-toggle"],
      globalDecisions: [{ id: "g1", scope: "global" as const, slot: "frontend.framework", mode: "PREFERRED" as const, resourceId: "astro" }],
      projectDecisions: [
        { id: "d2", scope: "project" as const, slot: "backend.framework", mode: "AI_DECIDE" as const, constraints: { notes: "small", allowed: ["Fastify"] } },
        { id: "d1", scope: "project" as const, slot: "frontend.framework", mode: "LOCKED" as const, resourceId: "next" },
      ],
    };
    const first = compileContext(input);
    const second = compileContext({
      ...input,
      resources: [...input.resources].reverse(),
      attachedResourceIds: [...input.attachedResourceIds].reverse(),
      projectDecisions: [...input.projectDecisions].reverse(),
    });
    expect(second).toEqual(first);
    expect(stableStringify(second)).toBe(stableStringify(first));
    expect(hashCanonical(second)).toBe(hashCanonical(first));
    expect(hashCanonical(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(JSON.stringify({ a: { c: null, d: [3, { y: 2, z: 1 }] }, b: 1 }, null, 2));
    expect(hashCanonical(compileContext({ ...input, project: { ...input.project, name: "Renamed" } }))).not.toBe(hashCanonical(first));
  });

  it("warns about missing resources without changing the user's decision mode", () => {
    for (const mode of ["LOCKED", "PREFERRED", "DISABLED"] as const) {
      const context = compileContext({ project, resources: [], projectDecisions: [{ id: "missing", scope: "project", slot: "custom.tool", mode, resourceId: null }] });
      expect(context.decisions[0]).toMatchObject({ mode, resource: null });
      expect(context.warnings).toEqual([expect.objectContaining({ code: "RESOURCE_UNRESOLVED", slot: "custom.tool", resourceId: null })]);
    }
    expect(compileContext({ project, resources: [], projectDecisions: [{ id: "delegated", scope: "project", slot: "custom.tool", mode: "AI_DECIDE", resourceId: null }] }).warnings).toEqual([]);
  });

  it("gives every export target the same decisions in a target-specific wrapper", () => {
    const output = compileContext({
      project,
      resources,
      projectDecisions: [{ id: "d1", scope: "project", slot: "frontend.framework", mode: "LOCKED", resourceId: "next" }],
    });
    const generic = renderExport("generic", output);
    for (const target of ["agents", "claude", "cursor", "copilot"] as const) {
      const rendered = renderExport(target, output);
      expect(rendered.content).toContain(generic.content.trim());
      expect(rendered.fileName.length).toBeGreaterThan(0);
    }
    expect(renderExport("cursor", output).content.startsWith("---\ndescription:")).toBe(true);
    expect(renderExport("agents", output).fileName).toBe("AGENTS.md");
    expect(renderExport("copilot", output).fileName).toBe(".github/copilot-instructions.md");
  });
});
