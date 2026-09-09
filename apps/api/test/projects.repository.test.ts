import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectListQuery } from "@devcontext/contracts";
import { count, eq, isNull, projectResources, projects, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createProjectRepository } from "../src/modules/projects/repository.js";
import { createProjectService, type ProjectRepository, type ProjectService } from "../src/modules/projects/service.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const activeA1 = "00000000-0000-4000-8000-000000000010";
const activeA2 = "00000000-0000-4000-8000-000000000011";
const archivedA = "00000000-0000-4000-8000-000000000012";
const activeB = "00000000-0000-4000-8000-000000000020";
const unknown = "00000000-0000-4000-8000-000000000099";
const requestKey = "00000000-0000-4000-8000-000000000077";
const listQuery: ProjectListQuery = { status: "active", limit: 50, offset: 0 };

let database: Pick<Database, "db" | "close">;
let repository: ProjectRepository;
let service: ProjectService;

async function projectCount() {
  return (await database.db.select({ value: count() }).from(projects))[0]?.value ?? 0;
}

beforeAll(async () => {
  database = await createTestDatabase();
  repository = createProjectRepository(database);
  service = createProjectService(repository);
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(resources).values([
    { id: activeA1, ownerUserId: ownerA, name: "Next.js", slug: "next-js-0010", type: "framework" },
    { id: activeA2, ownerUserId: ownerA, name: "PostgreSQL", slug: "postgresql-0011", type: "database" },
    { id: archivedA, ownerUserId: ownerA, name: "Old starter", slug: "old-starter-0012", type: "boilerplate", archivedAt: new Date("2026-01-01T00:00:00Z") },
    { id: activeB, ownerUserId: ownerB, name: "Foreign tool", slug: "foreign-tool-0020", type: "cli" },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("Project persistence", () => {
  it("creates a Project with the owner's active attachments and replays the same client request", async () => {
    const first = await service.create(ownerA, {
      clientRequestId: requestKey, name: "Atlas Finance", description: "Finance SaaS", productType: "SaaS",
      stage: "mvp", platforms: ["web", " Web", "mobile"], priorities: ["Fast MVP"], rules: [], resourceIds: [activeA2, activeA1],
    });
    expect(first.created).toBe(true);
    expect(first.project).toMatchObject({ status: "active", platforms: ["web", "mobile"], priorities: ["Fast MVP"] });
    expect(first.project.resources.map((item) => item.name).sort()).toEqual(["Next.js", "PostgreSQL"]);
    const retry = await service.create(ownerA, { clientRequestId: requestKey, name: "Atlas Finance retry", stage: "production", platforms: [], priorities: [], rules: [] });
    expect(retry.created).toBe(false);
    expect(retry.project.id).toBe(first.project.id);
    expect(retry.project.name).toBe("Atlas Finance");
    expect(await projectCount()).toBe(1);
  });

  it("rejects foreign, archived and unknown Resources identically and persists nothing", async () => {
    for (const rejected of [activeB, archivedA, unknown]) {
      await expect(service.create(ownerA, {
        name: "Leak attempt", stage: "mvp", platforms: ["web"], priorities: [], rules: [], resourceIds: [activeA1, rejected],
      })).rejects.toMatchObject({ statusCode: 400, details: [{ path: ["resourceIds", "1"], code: "resource_unavailable" }] });
    }
    expect(await projectCount()).toBe(1);
    expect((await service.list(ownerA, listQuery)).total).toBe(1);
  });

  it("keeps existing attachments visible after a Resource is archived and still blocks new archived picks", async () => {
    const { projects: [project] } = await service.list(ownerA, listQuery);
    await database.db.update(resources).set({ archivedAt: new Date() }).where(eq(resources.id, activeA2));
    const stored = await service.get(ownerA, project!.id);
    expect(stored.resources.find((item) => item.id === activeA2)?.archivedAt).toEqual(expect.any(String));

    const edited = await service.update(ownerA, project!.id, { name: "Atlas Finance v2", resourceIds: [activeA2, activeA1] });
    expect(edited.name).toBe("Atlas Finance v2");
    expect(edited.resources.map((item) => item.id).sort()).toEqual([activeA1, activeA2].sort());
    await expect(service.update(ownerA, project!.id, { resourceIds: [activeA2, activeA1, archivedA] }))
      .rejects.toMatchObject({ details: [{ path: ["resourceIds", "2"], code: "resource_unavailable" }] });
    const untouched = await service.update(ownerA, project!.id, { description: "Attachments stay as they are" });
    expect(untouched.resources).toHaveLength(2);
    const detached = await service.update(ownerA, project!.id, { resourceIds: [activeA1] });
    expect(detached.resources.map((item) => item.id)).toEqual([activeA1]);
    await database.db.update(resources).set({ archivedAt: null }).where(eq(resources.id, activeA2));
    expect((await database.db.select({ value: count() }).from(resources).where(isNull(resources.archivedAt)))[0]?.value).toBe(3);
  });

  it("isolates owners and supports search, archive and restore", async () => {
    const { projects: [project] } = await service.list(ownerA, listQuery);
    expect(await repository.findById(ownerB, project!.id)).toBeNull();
    expect(await repository.update(ownerB, project!.id, { name: "Hijack" }, undefined, undefined)).toBeNull();
    expect(await repository.setStatus(ownerB, project!.id, "archived")).toBeNull();
    expect((await service.list(ownerB, { ...listQuery, status: "all" })).total).toBe(0);
    expect((await service.get(ownerA, project!.id)).name).toBe("Atlas Finance v2");

    expect((await service.list(ownerA, { ...listQuery, q: "atlas" })).total).toBe(1);
    expect((await service.list(ownerA, { ...listQuery, q: "saas" })).total).toBe(1);
    expect((await service.list(ownerA, { ...listQuery, q: "zzz" })).total).toBe(0);
    expect((await service.list(ownerA, { ...listQuery, stage: "production" })).total).toBe(0);

    expect((await service.archive(ownerA, project!.id)).status).toBe("archived");
    expect((await service.list(ownerA, listQuery)).total).toBe(0);
    expect((await service.list(ownerA, { ...listQuery, status: "archived" })).total).toBe(1);
    expect((await database.db.select({ value: count() }).from(projectResources))[0]?.value).toBe(1);
    expect((await service.restore(ownerA, project!.id)).status).toBe("active");
    expect((await service.get(ownerA, project!.id)).resources).toHaveLength(1);
  });
});
