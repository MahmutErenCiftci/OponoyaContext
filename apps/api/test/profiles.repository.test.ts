import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProfileListQuery } from "@devcontext/contracts";
import { count, eq, profileDecisions, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createContextService, type ContextService } from "../src/modules/context/service.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService, type DecisionService } from "../src/modules/decisions/service.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService, type ProfileService } from "../src/modules/profiles/service.js";
import { createProjectRepository } from "../src/modules/projects/repository.js";
import { createProjectService, type ProjectService } from "../src/modules/projects/service.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const nextJs = "00000000-0000-4000-8000-000000000010";
const astro = "00000000-0000-4000-8000-000000000011";
const postgres = "00000000-0000-4000-8000-000000000012";
const archivedKit = "00000000-0000-4000-8000-000000000013";
const foreign = "00000000-0000-4000-8000-000000000020";
const base = { priority: 0, constraints: {}, rationale: null, conditions: {} };
const listQuery: ProfileListQuery = { archived: "active", limit: 50, offset: 0 };

let database: Pick<Database, "db" | "close">;
let profiles: ProfileService;
let projects: ProjectService;
let decisions: DecisionService;
let context: ContextService;
let stackId = "";
let designId = "";

beforeAll(async () => {
  database = await createTestDatabase();
  profiles = createProfileService(createProfileRepository(database));
  projects = createProjectService(createProjectRepository(database));
  decisions = createDecisionService(createDecisionRepository(database));
  context = createContextService(createContextRepository(database));
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(resources).values([
    { id: nextJs, ownerUserId: ownerA, name: "Next.js", slug: "next-js", type: "framework", sourceUrl: "https://nextjs.org" },
    { id: astro, ownerUserId: ownerA, name: "Astro", slug: "astro", type: "framework" },
    { id: postgres, ownerUserId: ownerA, name: "PostgreSQL", slug: "postgresql", type: "database" },
    { id: archivedKit, ownerUserId: ownerA, name: "Old kit", slug: "old-kit", type: "ui_library", archivedAt: new Date("2026-01-01T00:00:00Z") },
    { id: foreign, ownerUserId: ownerB, name: "Foreign", slug: "foreign", type: "framework" },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("Profiles and composer persistence", () => {
  it("creates, edits, archives and restores Profiles with owner scoping", async () => {
    const stack = await profiles.create(ownerA, { name: "Fast SaaS", type: "stack", description: "Default web stack" });
    stackId = stack.id;
    expect(stack.slug).toMatch(/^fast-saas-[a-f0-9]{8}$/);
    expect(stack).toMatchObject({ type: "stack", decisionCount: 0, projectCount: 0, archivedAt: null, decisions: [] });
    const design = await profiles.create(ownerA, { name: "Design profile", type: "design" });
    designId = design.id;
    expect((await profiles.list(ownerA, listQuery)).total).toBe(2);
    expect((await profiles.list(ownerA, { ...listQuery, type: "design" })).profiles.map((item) => item.name)).toEqual(["Design profile"]);
    expect((await profiles.update(ownerA, stackId, { description: "  Boring, proven web stack  " })).description).toBe("Boring, proven web stack");
    const archived = await profiles.archive(ownerA, designId);
    expect(archived.archivedAt).toEqual(expect.any(String));
    expect((await profiles.list(ownerA, listQuery)).total).toBe(1);
    expect((await profiles.list(ownerA, { ...listQuery, archived: "archived" })).total).toBe(1);
    expect((await profiles.restore(ownerA, designId)).archivedAt).toBeNull();
    await expect(profiles.get(ownerB, stackId)).rejects.toMatchObject({ statusCode: 404 });
    await expect(profiles.update(ownerB, stackId, { name: "Hijack" })).rejects.toMatchObject({ statusCode: 404 });
    expect((await profiles.list(ownerB, { ...listQuery, archived: "all" })).total).toBe(0);
  });

  it("stores Profile decisions with the same validation as Project decisions", async () => {
    const locked = await profiles.upsertDecision(ownerA, stackId, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs, rationale: "App Router" });
    expect(locked).toMatchObject({ scope: "profile", mode: "LOCKED", origin: { id: stackId, name: "Fast SaaS", priority: 0 }, resource: { name: "Next.js" } });
    await profiles.upsertDecision(ownerA, stackId, "database.primary", { ...base, mode: "PREFERRED", resourceId: postgres });
    await profiles.upsertDecision(ownerA, designId, "frontend.framework", { ...base, mode: "PREFERRED", resourceId: astro, priority: 9 });
    await profiles.upsertDecision(ownerA, designId, "frontend.ui.base", { ...base, mode: "AI_DECIDE", resourceId: null, constraints: { allowed: ["shadcn/ui"] } });
    await expect(profiles.upsertDecision(ownerA, stackId, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: nextJs }))
      .rejects.toMatchObject({ details: [{ path: ["resourceId"], code: "resource_not_allowed" }] });
    for (const rejected of [foreign, archivedKit]) {
      await expect(profiles.upsertDecision(ownerA, stackId, "frontend.ui.base", { ...base, mode: "LOCKED", resourceId: rejected }))
        .rejects.toMatchObject({ details: [{ path: ["resourceId"], code: "resource_unavailable" }] });
    }
    const again = await profiles.upsertDecision(ownerA, stackId, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs, priority: 3 });
    expect(again.id).toBe(locked.id);
    expect((await database.db.select({ value: count() }).from(profileDecisions).where(eq(profileDecisions.profileId, stackId)))[0]?.value).toBe(2);
    expect((await profiles.get(ownerA, stackId)).decisionCount).toBe(2);
    await profiles.upsertDecision(ownerA, stackId, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null });
    await profiles.removeDecision(ownerA, stackId, "backend.framework");
    expect((await profiles.get(ownerA, stackId)).decisions.map((item) => item.slot)).toEqual(["database.primary", "frontend.framework"]);
    await expect(profiles.upsertDecision(ownerB, stackId, "frontend.framework", { ...base, mode: "LOCKED", resourceId: foreign })).rejects.toMatchObject({ statusCode: 404 });
    await expect(profiles.removeDecision(ownerB, stackId, "frontend.framework")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("attaches Profiles with explicit priority and resolves same-slot conflicts deterministically", async () => {
    const { project } = await projects.create(ownerA, {
      name: "Atlas", stage: "mvp", platforms: ["web"], priorities: [], rules: ["Prefer boring technology."],
      profiles: [{ profileId: stackId, priority: 5 }, { profileId: designId, priority: 1 }],
    });
    expect(project.profiles.map((item) => [item.name, item.priority])).toEqual([["Fast SaaS", 5], ["Design profile", 1]]);
    expect(project.rules).toEqual(["Prefer boring technology."]);

    let views = await decisions.list(ownerA, project.id);
    const framework = views.find((view) => view.slot === "frontend.framework");
    expect(framework).toMatchObject({ source: "profile", effective: { mode: "LOCKED", origin: { name: "Fast SaaS", priority: 5 } } });
    expect(framework?.profiles.map((item) => item.origin?.name)).toEqual(["Fast SaaS", "Design profile"]);
    expect(views.find((view) => view.slot === "frontend.ui.base")?.effective).toMatchObject({ mode: "AI_DECIDE", origin: { name: "Design profile" } });

    const overridden = await decisions.upsert(ownerA, project.id, "frontend.framework", { ...base, mode: "AI_DECIDE", resourceId: null });
    expect(overridden).toMatchObject({ source: "project", profile: { origin: { name: "Fast SaaS" } } });
    expect((await decisions.remove(ownerA, project.id, "frontend.framework"))?.source).toBe("profile");

    await projects.update(ownerA, project.id, { profiles: [{ profileId: stackId, priority: 1 }, { profileId: designId, priority: 5 }] });
    views = await decisions.list(ownerA, project.id);
    expect(views.find((view) => view.slot === "frontend.framework")?.effective).toMatchObject({ mode: "PREFERRED", origin: { name: "Design profile", priority: 5 } });

    await profiles.archive(ownerA, designId);
    const stillAttached = await projects.get(ownerA, project.id);
    expect(stillAttached.profiles.find((item) => item.id === designId)?.archivedAt).toEqual(expect.any(String));
    expect((await decisions.list(ownerA, project.id)).find((view) => view.slot === "frontend.framework")?.effective.origin?.name).toBe("Design profile");
    await expect(projects.create(ownerA, { name: "Blocked", stage: "mvp", platforms: [], priorities: [], rules: [], profiles: [{ profileId: designId, priority: 0 }] }))
      .rejects.toMatchObject({ details: [{ path: ["profiles", "0", "profileId"], code: "profile_unavailable" }] });
    await expect(projects.create(ownerA, { name: "Blocked", stage: "mvp", platforms: [], priorities: [], rules: [], profiles: [{ profileId: "00000000-0000-4000-8000-000000000099", priority: 0 }] }))
      .rejects.toMatchObject({ details: [{ path: ["profiles", "0", "profileId"], code: "profile_unavailable" }] });
    await profiles.restore(ownerA, designId);
    expect((await profiles.get(ownerA, stackId)).projectCount).toBe(1);

    const batched = await decisions.batch(ownerA, project.id, {
      decisions: [{ ...base, slot: "backend.framework", mode: "AI_DECIDE", resourceId: null, constraints: { allowed: ["Fastify"] } }, { ...base, slot: "frontend.framework", mode: "LOCKED", resourceId: nextJs }],
      removeSlots: [],
    });
    expect(batched.filter((view) => view.source === "project").map((view) => view.slot)).toEqual(["backend.framework", "frontend.framework"]);
  });

  it("feeds Profile decisions, attachment priorities and rules into the compiler with provenance", async () => {
    const [atlas] = (await projects.list(ownerA, { status: "active", limit: 10, offset: 0 })).projects;
    const compiled = await context.compile(ownerA, atlas!.id);
    const { canonical } = compiled.version;
    expect(canonical.compilerVersion).toBe("0.4.1");
    expect(canonical.rules).toEqual(["Prefer boring technology."]);
    const framework = canonical.decisions.find((decision) => decision.slot === "frontend.framework");
    expect(framework).toMatchObject({ source: "project", mode: "LOCKED" });
    expect(framework?.shadowed.map((item) => item.origin?.name)).toEqual(["Design profile", "Fast SaaS"]);
    const database_ = canonical.decisions.find((decision) => decision.slot === "database.primary");
    expect(database_).toMatchObject({ source: "profile", origin: { id: stackId, name: "Fast SaaS", priority: 1 }, resource: { name: "PostgreSQL" } });
    const master = compiled.version.previews.find((preview) => preview.target === "generic")!.content;
    expect(master).toContain('- Source: profile "Fast SaaS"');
    expect(master).toContain("## Engineering rules");

    const { project: second } = await projects.create(ownerA, {
      name: "Beacon", stage: "mvp", platforms: ["web"], priorities: [], rules: [],
      profiles: [{ profileId: stackId, priority: 5 }, { profileId: designId, priority: 1 }],
    });
    const other = await context.compile(ownerA, second.id);
    expect(other.version.contentHash).not.toBe(compiled.version.contentHash);
    expect(other.version.canonical.decisions.find((decision) => decision.slot === "frontend.framework")).toMatchObject({ source: "profile", origin: { name: "Fast SaaS" }, mode: "LOCKED" });
  });
});
