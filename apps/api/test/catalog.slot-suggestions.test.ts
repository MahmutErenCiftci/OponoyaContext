import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { catalogSlotSuggestionsSchema } from "@devcontext/contracts";
import { projectDecisions, projectResources, projects, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createCatalogService, type CatalogService } from "../src/modules/catalog/service.js";
import { createCatalogTransaction } from "../src/modules/catalog/transaction.js";
import { createCatalogUsageRepository, createSlotSuggestionService, rankSlotSuggestions, slotSuggestionLimit } from "../src/modules/catalog/slot-suggestions.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService } from "../src/modules/profiles/service.js";
import { createResourceRepository } from "../src/modules/resources/repository.js";
import { createResourceService, type ResourceService } from "../src/modules/resources/service.js";

const none = new Set<string>();
const noAdoption = new Map<string, number>();

describe("wizard slot suggestions (ranking)", () => {
  it("offers catalog picks for an empty Library, best first and bounded", () => {
    const slots = rankSlotSuggestions({ active: none, previous: none, adoption: noAdoption });
    for (const slot of ["frontend.language", "frontend.framework", "backend.framework", "database.primary", "auth.provider", "ai.coding.primary", "infra.deployment.primary"]) {
      expect(slots[slot]?.length, slot).toBeGreaterThan(0);
      expect(slots[slot]!.length).toBeLessThanOrEqual(slotSuggestionLimit);
      const scores = slots[slot]!.map((item) => item.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    }
    // TypeScript can fill both language slots.
    expect(slots["frontend.language"]!.map((item) => item.slug)).toContain("typescript");
    expect(slots["backend.language"]!.map((item) => item.slug)).toContain("typescript");
  });

  it("keeps ML, data-engineering and add-on tools out of app slots", () => {
    const slots = rankSlotSuggestions({ active: none, previous: none, adoption: noAdoption });
    const all = (slot: string) => slots[slot]?.map((item) => item.name) ?? [];
    expect(all("backend.framework")).not.toContain("PyTorch");
    expect(all("backend.framework")).not.toContain("Apache Spark");
    expect(all("database.primary")).not.toContain("Snowflake");
    expect(all("database.primary")).not.toContain("pgvector");
    expect(all("infra.deployment.primary")).not.toContain("GitHub Actions");
    expect(all("ai.coding.primary")).not.toContain("Ollama");
  });

  it("never suggests what the Library holds and ranks earlier use, adoption and pairings up", () => {
    const base = rankSlotSuggestions({ active: none, previous: none, adoption: noAdoption });
    const last = base["database.primary"]!.at(-1)!;

    const withLibrary = rankSlotSuggestions({ active: new Set(["postgresql"]), previous: none, adoption: noAdoption });
    expect(withLibrary["database.primary"]!.map((item) => item.slug)).not.toContain("postgresql");
    // Drizzle pairs with PostgreSQL, so owning PostgreSQL gives it the pairing reason.
    expect(withLibrary["database.query_layer"]!.find((item) => item.slug === "drizzle-orm")?.reasons).toContain("pairs_with");

    const usedBefore = rankSlotSuggestions({ active: none, previous: new Set([last.slug]), adoption: noAdoption });
    expect(usedBefore["database.primary"]![0]).toMatchObject({ slug: last.slug, reasons: expect.arrayContaining(["used_before"]) });

    const popular = rankSlotSuggestions({ active: none, previous: none, adoption: new Map([[last.slug, 200]]) });
    expect(popular["database.primary"]![0]).toMatchObject({ slug: last.slug, reasons: expect.arrayContaining(["popular_here"]) });
    // A couple of users is not "popular", and it must not move the score either: the score would hint that someone else keeps it.
    const fewUsers = rankSlotSuggestions({ active: none, previous: none, adoption: new Map([[last.slug, 2]]) });
    expect(fewUsers).toEqual(base);
  });

  it("lists pairings in both directions so the wizard can boost them", () => {
    const slots = rankSlotSuggestions({ active: none, previous: none, adoption: noAdoption });
    const next = slots["frontend.framework"]!.find((item) => item.slug === "nextjs");
    expect(next?.pairsWith).toContain("typescript");
    expect(rankSlotSuggestions({ active: none, previous: none, adoption: noAdoption })).toEqual(slots);
  });
});

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const ownerC = "00000000-0000-4000-8000-000000000003";

let database: Pick<Database, "db" | "close">;
let resourcesService: ResourceService;
let catalog: CatalogService;

beforeAll(async () => {
  database = await createTestDatabase();
  resourcesService = createResourceService(createResourceRepository(database));
  catalog = createCatalogService(resourcesService, createProfileService(createProfileRepository(database)), createCatalogTransaction(database));
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
    { id: ownerC, email: "c@example.test", name: "Owner C" },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("wizard slot suggestions (real SQL)", () => {
  it("counts adoption across accounts, usage per owner, and excludes the owner's Library", async () => {
    for (const owner of [ownerA, ownerB, ownerC]) await catalog.addTechnology(owner, "supabase");
    const typescript = (await catalog.addTechnology(ownerA, "typescript")).resource;
    const drizzle = (await catalog.addTechnology(ownerA, "drizzle-orm")).resource;
    await resourcesService.archive(ownerA, drizzle.id);

    const [first, second] = await database.db.insert(projects).values([
      { ownerUserId: ownerA, name: "Atlas", slug: "atlas" },
      { ownerUserId: ownerA, name: "Beacon", slug: "beacon" },
    ]).returning();
    await database.db.insert(projectResources).values({ projectId: first!.id, resourceId: typescript.id });
    await database.db.insert(projectDecisions).values({ projectId: second!.id, slot: "frontend.language", mode: "PREFERRED", resourceId: typescript.id });

    const usage = createCatalogUsageRepository(database);
    expect((await usage.adoption()).get("supabase")).toBe(3);
    expect(await usage.projectUsage(ownerA)).toEqual({ [typescript.id]: 2 });
    expect(await usage.projectUsage(ownerB)).toEqual({});

    const service = createSlotSuggestionService(resourcesService, createCatalogUsageRepository(database));
    const forA = catalogSlotSuggestionsSchema.parse(await service.forOwner(ownerA));
    expect(forA.usage).toEqual({ [typescript.id]: 2 });
    expect(forA.slots["frontend.language"]!.map((item) => item.slug)).not.toContain("typescript");
    expect(forA.slots["database.primary"]!.map((item) => item.slug)).not.toContain("supabase");
    // Drizzle was archived from A's Library: it comes back first, marked as used before.
    expect(forA.slots["database.query_layer"]![0]).toMatchObject({ slug: "drizzle-orm", reasons: expect.arrayContaining(["used_before"]) });

    const forB = await service.forOwner(ownerB);
    expect(forB.usage).toEqual({});
    expect(forB.slots["database.query_layer"]!.find((item) => item.slug === "drizzle-orm")?.reasons ?? []).not.toContain("used_before");
  });
});
