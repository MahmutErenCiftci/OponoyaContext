import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  apiErrorSchema,
  catalogLibraryAddResponseSchema,
  catalogLibraryLinksResponseSchema,
  catalogOverviewResponseSchema,
  catalogStackLibraryResultSchema,
  catalogStackListResponseSchema,
  catalogStackProfileResponseSchema,
  catalogStackResponseSchema,
  catalogTechnologyListResponseSchema,
  catalogTechnologyResponseSchema,
  type CreateResourceInput,
  type DecisionRecord,
  type Profile,
  type Resource,
} from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { createCatalogService } from "../src/modules/catalog/service.js";
import type { ProfileService } from "../src/modules/profiles/service.js";
import type { ResourceService } from "../src/modules/resources/service.js";
import { memoryAudit } from "./support/memory-audit.js";
import { unlimitedEntitlements } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const now = new Date().toISOString();

function notFound() {
  return Object.assign(new Error("Not found"), { statusCode: 404 });
}

function auth(): AuthProvider {
  return {
    async handler() { return new Response(); },
    async getSession(headers) {
      const match = /session=(owner-a|owner-b)/.exec(headers.get("cookie") ?? "");
      if (!match?.[1]) return null;
      return { user: { id: match[1] === "owner-a" ? ownerA : ownerB, email: `${match[1]}@example.test`, name: match[1], image: null } };
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
  };
}

/** Owner-scoped in-memory Library; enough for the catalog bridge without a database. */
function fakeResources() {
  const store = new Map<string, Resource[]>();
  const of = (owner: string) => { const list = store.get(owner) ?? []; store.set(owner, list); return list; };
  let counter = 0;
  const make = (input: CreateResourceInput): Resource => {
    counter += 1;
    return {
      id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`, name: input.name, slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${counter}`, type: input.type,
      description: input.description ?? null, sourceUrl: input.sourceUrl ?? null, docsUrl: input.docsUrl ?? null, repoUrl: input.repoUrl ?? null, installCommand: input.installCommand ?? null,
      notes: input.notes ?? null, metadata: input.metadata, tags: input.tags, preference: null, favorite: false, archivedAt: null, createdAt: now, updatedAt: now,
    };
  };
  const find = (owner: string, id: string) => { const resource = of(owner).find((item) => item.id === id); if (!resource) throw notFound(); return resource; };
  const service: ResourceService = {
    list: vi.fn(async (owner) => ({ resources: of(owner), total: of(owner).length })),
    get: vi.fn(async (owner, id) => find(owner, id)),
    create: vi.fn(async (owner, input) => { const resource = make(input); of(owner).push(resource); return { resource, warnings: [], duplicates: [] }; }),
    update: vi.fn(async () => { throw new Error("not used"); }),
    archive: vi.fn(async (owner, id) => { const resource = find(owner, id); resource.archivedAt = now; return { resource, warnings: [], duplicates: [] }; }),
    restore: vi.fn(async (owner, id) => { const resource = find(owner, id); resource.archivedAt = null; return { resource, warnings: [], duplicates: [] }; }),
    listCatalogLinks: vi.fn(async (owner) => of(owner).flatMap((item) => typeof item.metadata.catalogSlug === "string" ? [{ catalogSlug: item.metadata.catalogSlug, resourceId: item.id, archived: item.archivedAt !== null }] : [])),
  };
  return { service, of };
}

function fakeProfiles() {
  const store = new Map<string, Profile[]>();
  const of = (owner: string) => { const list = store.get(owner) ?? []; store.set(owner, list); return list; };
  let counter = 500;
  const find = (owner: string, id: string) => { const profile = of(owner).find((item) => item.id === id); if (!profile) throw notFound(); return profile; };
  const service: ProfileService = {
    list: vi.fn(async (owner, query) => {
      const profiles = of(owner).filter((item) => !item.archivedAt && (!query.type || item.type === query.type) && (!query.q || item.name.toLowerCase().includes(query.q.toLowerCase())));
      return { profiles, total: profiles.length };
    }),
    get: vi.fn(async (owner, id) => find(owner, id)),
    create: vi.fn(async (owner, input) => {
      counter += 1;
      const profile: Profile = { id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`, name: input.name, slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${counter}`, type: input.type, description: input.description ?? null, decisionCount: 0, projectCount: 0, archivedAt: null, createdAt: now, updatedAt: now, decisions: [] };
      of(owner).push(profile);
      return profile;
    }),
    update: vi.fn(async () => { throw new Error("not used"); }),
    archive: vi.fn(async () => { throw new Error("not used"); }),
    restore: vi.fn(async () => { throw new Error("not used"); }),
    upsertDecision: vi.fn(async (owner, id, slot, input) => {
      const profile = find(owner, id);
      counter += 1;
      const record: DecisionRecord = { id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`, scope: "profile", origin: null, slot, mode: input.mode, resource: null, priority: input.priority, constraints: input.constraints, rationale: input.rationale, conditions: input.conditions, updatedAt: now };
      profile.decisions = [...profile.decisions.filter((item) => item.slot !== slot), record];
      profile.decisionCount = profile.decisions.length;
      return record;
    }),
    removeDecision: vi.fn(async () => { throw new Error("not used"); }),
    saveFromProject: vi.fn(async () => { throw new Error("not used"); }),
  };
  return { service, of };
}

async function createApp() {
  const resources = fakeResources();
  const profiles = fakeProfiles();
  const audit = memoryAudit();
  const app = await buildApp(readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }), {
    auth: auth(), resources: resources.service, profiles: profiles.service, catalog: createCatalogService(resources.service, profiles.service), audit, entitlements: unlimitedEntitlements(),
  });
  apps.push(app);
  return { app, resources, profiles, audit };
}

const asA = { cookie: "session=owner-a" };
const asB = { cookie: "session=owner-b" };

describe("technology catalog routes", () => {
  it("serves reference data to signed-in users only and validates slugs", async () => {
    const { app } = await createApp();
    expect((await app.inject("/v1/catalog")).statusCode).toBe(401);
    const overview = catalogOverviewResponseSchema.parse((await app.inject({ url: "/v1/catalog", headers: asA })).json()).catalog;
    expect(overview.technologyCount).toBe(246);
    expect(overview.stackCount).toBe(15);
    expect(overview.methodology.warning).toContain("editör değerlendirmesi");
    const turkey = catalogTechnologyListResponseSchema.parse((await app.inject({ url: "/v1/catalog/technologies?domain=turkey&limit=5", headers: asA })).json());
    expect(turkey.total).toBe(12);
    expect(turkey.technologies).toHaveLength(5);
    const search = catalogTechnologyListResponseSchema.parse((await app.inject({ url: "/v1/catalog/technologies?q=drizzle", headers: asA })).json());
    expect(search.technologies.map((item) => item.slug)).toContain("drizzle-orm");
    const detail = catalogTechnologyResponseSchema.parse((await app.inject({ url: "/v1/catalog/technologies/nextjs", headers: asA })).json()).technology;
    expect(detail.readiness?.aiBuildability).toBeGreaterThanOrEqual(1);
    expect(detail.stacks.map((stack) => stack.slug)).toContain("t3-stack");
    const missing = await app.inject({ url: "/v1/catalog/technologies/not-a-technology", headers: asA });
    expect(missing.statusCode).toBe(404);
    expect(apiErrorSchema.parse(missing.json()).error.message).toBe("This catalog technology does not exist.");
    expect((await app.inject({ url: "/v1/catalog/technologies/NOPE!", headers: asA })).statusCode).toBe(400);
    const stacks = catalogStackListResponseSchema.parse((await app.inject({ url: "/v1/catalog/stacks", headers: asA })).json()).stacks;
    expect(stacks.find((stack) => stack.slug === "vibe-coding-stack")).toMatchObject({ prototypeSpeed: 5, productionReadiness: 2 });
    const stack = catalogStackResponseSchema.parse((await app.inject({ url: "/v1/catalog/stacks/t3-stack", headers: asA })).json()).stack;
    expect(stack.layers[0]?.technologies[0]).toMatchObject({ slug: "typescript", known: true });
    expect((await app.inject({ url: "/v1/catalog/stacks/nope", headers: asA })).statusCode).toBe(404);
  });

  it("adds a technology to the Library idempotently and audits without content", async () => {
    const { app, audit } = await createApp();
    const first = await app.inject({ method: "POST", url: "/v1/catalog/technologies/nextjs/library", headers: asA });
    expect(first.statusCode).toBe(201);
    const added = catalogLibraryAddResponseSchema.parse(first.json());
    expect(added.created).toBe(true);
    expect(added.resource).toMatchObject({ name: "Next.js", type: "framework", sourceUrl: expect.stringContaining("nextjs.org") });
    expect(added.resource.metadata).toMatchObject({ catalogSlug: "nextjs", catalogDomain: "frontend" });
    expect(added.resource.tags).toContain("frontend");
    expect(added.resource.notes).toContain("editör değerlendirmesi");
    const again = await app.inject({ method: "POST", url: "/v1/catalog/technologies/nextjs/library", headers: asA });
    expect(again.statusCode).toBe(200);
    expect(catalogLibraryAddResponseSchema.parse(again.json())).toMatchObject({ created: false, resource: { id: added.resource.id } });
    const links = catalogLibraryLinksResponseSchema.parse((await app.inject({ url: "/v1/catalog/library", headers: asA })).json()).links;
    expect(links).toEqual({ nextjs: added.resource.id });
    expect(catalogLibraryLinksResponseSchema.parse((await app.inject({ url: "/v1/catalog/library", headers: asB })).json()).links).toEqual({});
    const events = audit.events.filter((event) => event.action === "catalog.technology_added");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ actorUserId: ownerA, entityType: "resource", entityId: added.resource.id, metadata: { catalogSlug: "nextjs", created: true } });
    expect(Object.keys(events[0]!.metadata)).toEqual(["catalogSlug", "created"]);
  });

  it("adds a whole stack and creates a preset Profile once", async () => {
    const { app, profiles } = await createApp();
    await app.inject({ method: "POST", url: "/v1/catalog/technologies/postgresql/library", headers: asA });
    const stack = await app.inject({ method: "POST", url: "/v1/catalog/stacks/t3-stack/library", headers: asA });
    expect(stack.statusCode).toBe(201);
    const library = catalogStackLibraryResultSchema.parse(stack.json());
    expect(library.existing.map((item) => item.name)).toEqual(["PostgreSQL"]);
    expect(library.created.length).toBeGreaterThan(8);
    expect(library.skipped).toEqual([]);
    const laravel = catalogStackLibraryResultSchema.parse((await app.inject({ method: "POST", url: "/v1/catalog/stacks/laravel-livewire/library", headers: asA })).json());
    expect(laravel.skipped).toContain("livewire");

    const profile = await app.inject({ method: "POST", url: "/v1/catalog/stacks/t3-stack/profile", headers: asA });
    expect(profile.statusCode).toBe(201);
    const result = catalogStackProfileResponseSchema.parse(profile.json());
    expect(result.created).toBe(true);
    expect(result.profile).toMatchObject({ name: "T3 Stack", type: "stack" });
    expect(Object.fromEntries(result.decisions.map((item) => [item.slot, item.technologySlug]))).toMatchObject({ "frontend.framework": "nextjs", "database.primary": "postgresql", "auth.provider": "better-auth" });
    expect(result.library.created).toHaveLength(0);
    expect(profiles.of(ownerA)[0]?.decisions.every((item) => item.mode === "PREFERRED")).toBe(true);
    const replay = await app.inject({ method: "POST", url: "/v1/catalog/stacks/t3-stack/profile", headers: asA });
    expect(replay.statusCode).toBe(200);
    expect(catalogStackProfileResponseSchema.parse(replay.json())).toMatchObject({ created: false, decisions: [], profile: { id: result.profile.id } });
    expect(profiles.of(ownerA)).toHaveLength(1);
    expect(profiles.of(ownerB)).toHaveLength(0);
    expect((await app.inject({ method: "POST", url: "/v1/catalog/stacks/nope/profile", headers: asA })).statusCode).toBe(404);
  });
});
