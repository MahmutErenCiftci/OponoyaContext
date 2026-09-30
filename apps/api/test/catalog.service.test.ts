import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resourceListQuerySchema } from "@devcontext/contracts";
import { users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createCatalogService, toResourceInput, type CatalogService, type CatalogTransaction } from "../src/modules/catalog/service.js";
import { createCatalogTransaction } from "../src/modules/catalog/transaction.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService, type ProfileService } from "../src/modules/profiles/service.js";
import { createResourceRepository } from "../src/modules/resources/repository.js";
import { createResourceService, type ResourceService } from "../src/modules/resources/service.js";
import { getTechnology } from "@devcontext/catalog";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";

let database: Pick<Database, "db" | "close">;
let resourcesService: ResourceService;
let profilesService: ProfileService;
let catalog: CatalogService;

beforeAll(async () => {
  database = await createTestDatabase();
  resourcesService = createResourceService(createResourceRepository(database));
  profilesService = createProfileService(createProfileRepository(database));
  catalog = createCatalogService(resourcesService, profilesService, createCatalogTransaction(database));
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("catalog to Library bridge", () => {
  it("maps a catalog entry to a bounded Resource input", () => {
    const input = toResourceInput(getTechnology("supabase")!);
    expect(input).toMatchObject({ name: "Supabase", sourceUrl: expect.stringContaining("supabase"), metadata: expect.objectContaining({ catalogSlug: "supabase", catalogDomain: "database" }) });
    expect(input.tags).toContain("database");
    expect(input.tags.every((tag) => tag.length <= 60)).toBe(true);
    expect(input.notes?.length).toBeLessThanOrEqual(10_000);
    expect(input.notes).toContain("Sık AI hataları");
  });

  it("adds a technology once, restores an archived copy and keeps owners apart", async () => {
    const first = await catalog.addTechnology(ownerA, "postgresql");
    expect(first.created).toBe(true);
    expect(first.resource).toMatchObject({ name: "PostgreSQL", type: "database" });
    expect(first.resource.metadata).toMatchObject({ catalogSlug: "postgresql" });
    expect(first.resource.tags).toContain("database");
    const again = await catalog.addTechnology(ownerA, "postgresql");
    expect(again).toMatchObject({ created: false, resource: { id: first.resource.id } });
    await resourcesService.archive(ownerA, first.resource.id);
    expect(await catalog.libraryLinks(ownerA)).toEqual({});
    const restored = await catalog.addTechnology(ownerA, "postgresql");
    expect(restored.created).toBe(false);
    expect(restored.resource.id).toBe(first.resource.id);
    expect(restored.resource.archivedAt).toBeNull();
    expect(await catalog.libraryLinks(ownerA)).toEqual({ postgresql: first.resource.id });
    expect(await catalog.libraryLinks(ownerB)).toEqual({});
    await expect(catalog.addTechnology(ownerA, "not-a-technology")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("adds a stack preset as Library entries plus one PREFERRED stack Profile", async () => {
    const result = await catalog.createStackProfile(ownerA, "t3-stack");
    expect(result.created).toBe(true);
    expect(result.library.existing.map((item) => item.name)).toEqual(["PostgreSQL"]);
    expect(result.library.created.length).toBeGreaterThan(8);
    expect(result.decisions.map((item) => item.slot)).toEqual(expect.arrayContaining(["frontend.framework", "database.primary", "database.query_layer", "auth.provider", "infra.deployment.primary"]));
    const profile = await profilesService.get(ownerA, result.profile.id);
    expect(profile).toMatchObject({ name: "T3 Stack", type: "stack" });
    expect(profile.decisions).toHaveLength(result.decisions.length);
    expect(profile.decisions.every((item) => item.mode === "PREFERRED" && item.resource !== null)).toBe(true);
    const replay = await catalog.createStackProfile(ownerA, "t3-stack");
    expect(replay).toMatchObject({ created: false, decisions: [], profile: { id: result.profile.id } });
    expect(replay.library.created).toHaveLength(0);
    expect((await resourcesService.list(ownerB, resourceListQuerySchema.parse({}))).total).toBe(0);
    expect((await profilesService.list(ownerB, { archived: "active", limit: 50, offset: 0 })).total).toBe(0);
  });

  it("rolls the whole stack back when any step fails", async () => {
    // The real transaction, with a Profile service that fails on the first preset decision.
    const failing: CatalogTransaction = (ownerUserId, work) => createCatalogTransaction(database)(ownerUserId, (scope) => work({
      resources: scope.resources,
      profiles: { ...scope.profiles, upsertDecision: async () => { throw new Error("decision write failed"); } },
    }));
    const broken = createCatalogService(resourcesService, profilesService, failing);
    await expect(broken.createStackProfile(ownerB, "t3-stack")).rejects.toThrow("decision write failed");
    expect((await resourcesService.list(ownerB, resourceListQuerySchema.parse({}))).total).toBe(0);
    expect((await profilesService.list(ownerB, { archived: "active", limit: 50, offset: 0 })).total).toBe(0);
    expect(await catalog.libraryLinks(ownerB)).toEqual({});
    // Nothing was left behind that would turn a retry into `created: false`.
    const retry = await catalog.createStackProfile(ownerB, "t3-stack");
    expect(retry.created).toBe(true);
    expect(retry.decisions.length).toBeGreaterThan(0);
  });

  it("serializes concurrent adds of the same technology for one owner", async () => {
    const results = await Promise.all([catalog.addTechnology(ownerB, "redis"), catalog.addTechnology(ownerB, "redis")]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results[0].resource.id).toBe(results[1].resource.id);
  });
});
