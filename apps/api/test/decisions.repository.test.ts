import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, eq, globalDecisions, projectDecisions, projects, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService, type DecisionService } from "../src/modules/decisions/service.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectA = "00000000-0000-4000-8000-000000000030";
const projectB = "00000000-0000-4000-8000-000000000031";
const nextJs = "00000000-0000-4000-8000-000000000010";
const fastify = "00000000-0000-4000-8000-000000000011";
const archived = "00000000-0000-4000-8000-000000000012";
const foreign = "00000000-0000-4000-8000-000000000020";
const unknown = "00000000-0000-4000-8000-000000000099";
const base = { priority: 0, constraints: {}, rationale: null, conditions: {} };

let database: Pick<Database, "db" | "close">;
let service: DecisionService;

beforeAll(async () => {
  database = await createTestDatabase();
  service = createDecisionService(createDecisionRepository(database));
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(resources).values([
    { id: nextJs, ownerUserId: ownerA, name: "Next.js", slug: "next-js", type: "framework" },
    { id: fastify, ownerUserId: ownerA, name: "Fastify", slug: "fastify", type: "framework" },
    { id: archived, ownerUserId: ownerA, name: "Old UI kit", slug: "old-ui-kit", type: "ui_library", archivedAt: new Date("2026-01-01T00:00:00Z") },
    { id: foreign, ownerUserId: ownerB, name: "Foreign", slug: "foreign", type: "framework" },
  ]);
  await database.db.insert(projects).values([
    { id: projectA, ownerUserId: ownerA, name: "Atlas", slug: "atlas-000" },
    { id: projectB, ownerUserId: ownerB, name: "Other", slug: "other-000" },
  ]);
  await database.db.insert(globalDecisions).values({ ownerUserId: ownerA, slot: "frontend.framework", mode: "PREFERRED", resourceId: nextJs });
}, 60_000);

afterAll(async () => { await database.close(); });

describe("Project decision persistence", () => {
  it("shows inherited global rules, lets a Project override shadow them and keeps the global row", async () => {
    const inherited = await service.list(ownerA, projectA);
    expect(inherited).toEqual([expect.objectContaining({ slot: "frontend.framework", source: "global", project: null })]);
    expect(inherited[0]?.effective.resource?.name).toBe("Next.js");

    const locked = await service.upsert(ownerA, projectA, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs, rationale: "Team standard" });
    expect(locked).toMatchObject({ source: "project", effective: { mode: "LOCKED", scope: "project" }, global: { mode: "PREFERRED", scope: "global" } });
    const again = await service.upsert(ownerA, projectA, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs, priority: 5 });
    expect(again.project?.id).toBe(locked.project?.id);
    expect(again.project?.priority).toBe(5);
    expect((await database.db.select({ value: count() }).from(projectDecisions))[0]?.value).toBe(1);
    expect((await database.db.select({ value: count() }).from(globalDecisions))[0]?.value).toBe(1);
  });

  it("stores AI Decide without a Resource and rejects foreign, archived and unknown Resources identically", async () => {
    const delegated = await service.upsert(ownerA, projectA, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null, constraints: { allowed: ["Fastify", "Hono"], notes: "Keep it boring" } });
    expect(delegated.effective).toMatchObject({ mode: "AI_DECIDE", resource: null, constraints: { allowed: ["Fastify", "Hono"], notes: "Keep it boring" } });
    for (const rejected of [foreign, archived, unknown]) {
      await expect(service.upsert(ownerA, projectA, "frontend.ui.base", { ...base, mode: "LOCKED", resourceId: rejected }))
        .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["resourceId"], code: "resource_unavailable" }] });
    }
    expect((await service.list(ownerA, projectA)).map((view) => view.slot)).toEqual(["backend.framework", "frontend.framework"]);
  });

  it("keeps decisions readable when their Resource is archived later and flags them", async () => {
    await service.upsert(ownerA, projectA, "backend.language", { ...base, mode: "PREFERRED", resourceId: fastify });
    await database.db.update(resources).set({ archivedAt: new Date() }).where(eq(resources.id, fastify));
    const view = (await service.list(ownerA, projectA)).find((item) => item.slot === "backend.language");
    expect(view?.effective.resource).toMatchObject({ name: "Fastify", archivedAt: expect.any(String) });
    await expect(service.upsert(ownerA, projectA, "backend.language", { ...base, mode: "LOCKED", resourceId: fastify }))
      .rejects.toMatchObject({ details: [{ path: ["resourceId"], code: "resource_unavailable" }] });
    await database.db.update(resources).set({ archivedAt: null }).where(eq(resources.id, fastify));
  });

  it("removes only the override and isolates owners on nested routes", async () => {
    const revealed = await service.remove(ownerA, projectA, "frontend.framework");
    expect(revealed).toMatchObject({ source: "global", project: null, effective: { mode: "PREFERRED", resource: { name: "Next.js" } } });
    expect(await service.remove(ownerA, projectA, "backend.framework")).toBeNull();
    expect((await database.db.select({ value: count() }).from(globalDecisions))[0]?.value).toBe(1);

    await expect(service.list(ownerB, projectA)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.upsert(ownerB, projectA, "frontend.framework", { ...base, mode: "LOCKED", resourceId: foreign })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.remove(ownerB, projectA, "backend.language")).rejects.toMatchObject({ statusCode: 404 });
    expect((await service.list(ownerB, projectB))).toEqual([]);
    await expect(service.upsert(ownerB, projectB, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs }))
      .rejects.toMatchObject({ details: [{ path: ["resourceId"], code: "resource_unavailable" }] });
    expect((await service.list(ownerA, projectA)).find((item) => item.slot === "backend.language")?.effective.mode).toBe("PREFERRED");
  });
});
