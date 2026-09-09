import { describe, expect, it } from "vitest";
import type { DecisionRecord } from "@devcontext/contracts";
import {
  createDecisionService,
  mergeDecisions,
  normalizeDecisionInput,
  resourceUnavailableError,
  type DecisionRepository,
} from "../src/modules/decisions/service.js";

const now = new Date().toISOString();
const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectA = "00000000-0000-4000-8000-000000000030";
const nextJs = "00000000-0000-4000-8000-000000000010";
const astro = "00000000-0000-4000-8000-000000000011";
const foreign = "00000000-0000-4000-8000-000000000020";
const base = { priority: 0, constraints: {}, rationale: null, conditions: {} };

function record(partial: Partial<DecisionRecord> & { slot: string; scope: DecisionRecord["scope"] }): DecisionRecord {
  return {
    id: crypto.randomUUID(), origin: null, mode: "PREFERRED", resource: null, priority: 0, constraints: {}, rationale: null, conditions: {}, updatedAt: now,
    ...partial,
  };
}

function resource(id: string, name: string): DecisionRecord["resource"] {
  return { id, name, slug: name.toLowerCase(), type: "framework", sourceUrl: null, archivedAt: null };
}

function createRepository() {
  const projectRows = new Map<string, DecisionRecord>();
  const globalRows: DecisionRecord[] = [record({ scope: "global", slot: "frontend.framework", mode: "PREFERRED", resource: resource(nextJs, "Next.js") })];
  const profileRows: DecisionRecord[] = [
    record({ scope: "profile", slot: "database.primary", mode: "PREFERRED", resource: resource(astro, "Astro"), origin: { id: "stack", name: "Fast SaaS", priority: 5 } }),
    record({ scope: "profile", slot: "database.primary", mode: "LOCKED", resource: resource(nextJs, "Next.js"), priority: 9, origin: { id: "design", name: "Design profile", priority: 1 } }),
  ];
  const owns = (ownerUserId: string, projectId: string) => ownerUserId === ownerA && projectId === projectA;
  const repository: DecisionRepository = {
    async projectExists(ownerUserId, projectId) { return owns(ownerUserId, projectId); },
    async listProjectDecisions(ownerUserId, projectId) { return owns(ownerUserId, projectId) ? [...projectRows.values()] : []; },
    async listRecipeDecisions() { return []; },
    async listProfileDecisions(ownerUserId, projectId) { return owns(ownerUserId, projectId) ? profileRows : []; },
    async listGlobalDecisions(ownerUserId) { return ownerUserId === ownerA ? globalRows : []; },
    async upsertProjectDecision(ownerUserId, projectId, slot, values) {
      if (!owns(ownerUserId, projectId)) return null;
      if (values.resourceId && ![nextJs, astro].includes(values.resourceId)) throw resourceUnavailableError();
      const saved = record({
        scope: "project", slot, mode: values.mode, priority: values.priority, constraints: values.constraints,
        rationale: values.rationale, conditions: values.conditions,
        resource: values.resourceId ? resource(values.resourceId, values.resourceId === nextJs ? "Next.js" : "Astro") : null,
      });
      projectRows.set(slot, saved);
      return saved;
    },
    async deleteProjectDecision(ownerUserId, projectId, slot) {
      if (!owns(ownerUserId, projectId)) return false;
      return projectRows.delete(slot);
    },
    async batchProjectDecisions(ownerUserId, projectId, upserts, removeSlots) {
      if (!owns(ownerUserId, projectId)) return false;
      const offending = upserts.findIndex((item) => item.values.resourceId && ![nextJs, astro].includes(item.values.resourceId));
      if (offending >= 0) throw resourceUnavailableError(offending);
      for (const slot of removeSlots) projectRows.delete(slot);
      for (const { slot, values } of upserts) {
        projectRows.set(slot, record({ scope: "project", slot, mode: values.mode, resource: values.resourceId ? resource(values.resourceId, "Next.js") : null, constraints: values.constraints }));
      }
      return true;
    },
  };
  return { repository, projectRows };
}

describe("Project decisions domain", () => {
  it("requires a Resource unless the slot is deliberately delegated", () => {
    expect(() => normalizeDecisionInput({ ...base, mode: "LOCKED", resourceId: null }))
      .toThrow(expect.objectContaining({ statusCode: 400, details: [{ path: ["resourceId"], code: "resource_required" }] }));
    expect(() => normalizeDecisionInput({ ...base, mode: "AI_DECIDE", resourceId: nextJs }))
      .toThrow(expect.objectContaining({ details: [{ path: ["resourceId"], code: "resource_not_allowed" }] }));
    expect(() => normalizeDecisionInput({ ...base, mode: "LOCKED", resourceId: null }, 3))
      .toThrow(expect.objectContaining({ details: [{ path: ["decisions", "3", "resourceId"], code: "resource_required" }] }));
    expect(normalizeDecisionInput({ ...base, mode: "AI_DECIDE", resourceId: null, priority: 2, constraints: { allowed: ["Fastify"] }, rationale: "  keep it small  " }))
      .toEqual({ mode: "AI_DECIDE", resourceId: null, priority: 2, constraints: { allowed: ["Fastify"] }, rationale: "keep it small", conditions: {} });
  });

  it("applies Project > Profile > Global precedence and keeps every layer visible", () => {
    const global = record({ scope: "global", slot: "frontend.framework", mode: "PREFERRED", resource: resource(nextJs, "Next.js") });
    const globalOnly = record({ scope: "global", slot: "database.primary", mode: "LOCKED" });
    const lowProfile = record({ scope: "profile", slot: "database.primary", mode: "LOCKED", priority: 9, origin: { id: "design", name: "Design profile", priority: 1 } });
    const highProfile = record({ scope: "profile", slot: "database.primary", mode: "PREFERRED", origin: { id: "stack", name: "Fast SaaS", priority: 5 } });
    const profileFramework = record({ scope: "profile", slot: "frontend.framework", mode: "LOCKED", origin: { id: "stack", name: "Fast SaaS", priority: 5 } });
    const project = record({ scope: "project", slot: "frontend.framework", mode: "LOCKED", resource: resource(nextJs, "Next.js") });
    const delegated = record({ scope: "project", slot: "backend.framework", mode: "AI_DECIDE" });
    const recipeDatabase = record({ scope: "recipe", slot: "database.primary", mode: "PREFERRED", resource: resource(astro, "Astro"), origin: { id: "saas", name: "SaaS MVP", priority: 0 } });
    const recipeCache = record({ scope: "recipe", slot: "database.cache", mode: "DISABLED", resource: resource(astro, "Astro"), origin: { id: "saas", name: "SaaS MVP", priority: 0 } });
    const merged = mergeDecisions([project, delegated], [recipeDatabase, recipeCache], [lowProfile, highProfile, profileFramework], [globalOnly, global]);
    expect(merged.map((view) => `${view.slot}:${view.source}`)).toEqual(["backend.framework:project", "database.cache:recipe", "database.primary:recipe", "frontend.framework:project"]);
    expect(merged[2]).toMatchObject({ effective: recipeDatabase, recipe: recipeDatabase, profile: highProfile, profiles: [highProfile, lowProfile], global: globalOnly, project: null });
    expect(merged[3]).toMatchObject({ effective: project, project, recipe: null, profile: profileFramework, profiles: [profileFramework], global });
    expect(merged[0]).toMatchObject({ source: "project", effective: delegated, recipe: null, profile: null, profiles: [], global: null });
    expect(merged[1]).toMatchObject({ source: "recipe", effective: recipeCache, project: null, profile: null, global: null });
    const withoutRecipe = mergeDecisions([project, delegated], [], [lowProfile, highProfile, profileFramework], [globalOnly, global]);
    expect(withoutRecipe.map((view) => `${view.slot}:${view.source}`)).toEqual(["backend.framework:project", "database.primary:profile", "frontend.framework:project"]);
  });

  it("upserts, batches, removes overrides and enforces ownership through the Project", async () => {
    const { repository, projectRows } = createRepository();
    const service = createDecisionService(repository);
    const inherited = await service.list(ownerA, projectA);
    expect(inherited.map((view) => `${view.slot}:${view.source}`)).toEqual(["database.primary:profile", "frontend.framework:global"]);
    expect(inherited[0]?.effective.origin).toEqual({ id: "stack", name: "Fast SaaS", priority: 5 });

    const locked = await service.upsert(ownerA, projectA, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs });
    expect(locked.source).toBe("project");
    expect(locked.global?.mode).toBe("PREFERRED");
    expect(locked.effective.mode).toBe("LOCKED");
    const delegated = await service.upsert(ownerA, projectA, "database.primary", { ...base, mode: "AI_DECIDE", resourceId: null, constraints: { allowed: ["PostgreSQL"] } });
    expect(delegated).toMatchObject({ source: "project", effective: { mode: "AI_DECIDE", resource: null }, profile: { origin: { name: "Fast SaaS" } } });

    await expect(service.upsert(ownerA, projectA, "auth.provider", { ...base, mode: "LOCKED", resourceId: foreign }))
      .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["resourceId"], code: "resource_unavailable" }] });

    const batched = await service.batch(ownerA, projectA, {
      decisions: [
        { ...base, slot: "backend.framework", mode: "AI_DECIDE", resourceId: null },
        { ...base, slot: "backend.framework", mode: "LOCKED", resourceId: nextJs },
        { ...base, slot: "auth.provider", mode: "PREFERRED", resourceId: astro },
      ],
      removeSlots: ["frontend.framework", "backend.framework"],
    });
    expect(batched.map((view) => `${view.slot}:${view.source}`)).toEqual(["auth.provider:project", "backend.framework:project", "database.primary:project", "frontend.framework:global"]);
    expect(projectRows.get("backend.framework")?.mode).toBe("AI_DECIDE");
    await expect(service.batch(ownerA, projectA, { decisions: [{ ...base, slot: "frontend.ui.base", mode: "LOCKED", resourceId: foreign }], removeSlots: [] }))
      .rejects.toMatchObject({ details: [{ path: ["decisions", "0", "resourceId"], code: "resource_unavailable" }] });

    const revealed = await service.remove(ownerA, projectA, "database.primary");
    expect(revealed).toMatchObject({ source: "profile", project: null, effective: { origin: { name: "Fast SaaS" } } });
    expect(await service.remove(ownerA, projectA, "backend.framework")).toBeNull();
    expect((await service.listGlobal(ownerA)).map((item) => item.slot)).toEqual(["frontend.framework"]);

    await expect(service.list(ownerB, projectA)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.upsert(ownerB, projectA, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.remove(ownerB, projectA, "frontend.framework")).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.batch(ownerB, projectA, { decisions: [], removeSlots: ["frontend.framework"] })).rejects.toMatchObject({ statusCode: 404 });
  });
});
