import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compatibilityRules, count, eq, profiles, projectDecisions, projectProfiles, projectResources, projects, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createCompatibilityRepository } from "../src/modules/compatibility/repository.js";
import { createCompatibilityService, type CompatibilityService } from "../src/modules/compatibility/service.js";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createContextService, type ContextService } from "../src/modules/context/service.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService, type DecisionService } from "../src/modules/decisions/service.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService, type ProfileService } from "../src/modules/profiles/service.js";
import { createProjectRepository } from "../src/modules/projects/repository.js";
import { createProjectService, type ProjectService } from "../src/modules/projects/service.js";
import { createResourceRepository } from "../src/modules/resources/repository.js";
import { createResourceService, type ResourceService } from "../src/modules/resources/service.js";
import { createSearchRepository } from "../src/modules/search/repository.js";
import { createSearchService, type SearchService } from "../src/modules/search/service.js";
import { createWorkspaceRepository, type WorkspaceRepository } from "../src/modules/workspace/repository.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const nextJs = "00000000-0000-4000-8000-000000000010";
const postgres = "00000000-0000-4000-8000-000000000011";
const redis = "00000000-0000-4000-8000-000000000012";
const archivedKit = "00000000-0000-4000-8000-000000000013";
const foreign = "00000000-0000-4000-8000-000000000020";
const base = { priority: 0, constraints: {}, rationale: null, conditions: {} };

let database: Pick<Database, "db" | "close">;
let resourcesService: ResourceService;
let projectsService: ProjectService;
let profilesService: ProfileService;
let decisionsService: DecisionService;
let contextService: ContextService;
let compatibility: CompatibilityService;
let search: SearchService;
let workspace: WorkspaceRepository;
let projectId = "";

beforeAll(async () => {
  database = await createTestDatabase();
  resourcesService = createResourceService(createResourceRepository(database));
  projectsService = createProjectService(createProjectRepository(database));
  profilesService = createProfileService(createProfileRepository(database));
  decisionsService = createDecisionService(createDecisionRepository(database));
  contextService = createContextService(createContextRepository(database));
  compatibility = createCompatibilityService(createCompatibilityRepository(database));
  search = createSearchService(createSearchRepository(database));
  workspace = createWorkspaceRepository(database);
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(resources).values([
    { id: nextJs, ownerUserId: ownerA, name: "Next.js", slug: "next-js", type: "framework", sourceUrl: "https://nextjs.org", description: "React framework" },
    { id: postgres, ownerUserId: ownerA, name: "PostgreSQL", slug: "postgresql", type: "database" },
    { id: redis, ownerUserId: ownerA, name: "Redis", slug: "redis", type: "cache" },
    { id: archivedKit, ownerUserId: ownerA, name: "Old kit", slug: "old-kit", type: "ui_library", archivedAt: new Date("2026-01-01T00:00:00Z") },
    { id: foreign, ownerUserId: ownerB, name: "Next.js clone", slug: "next-js-clone", type: "framework", sourceUrl: "https://nextjs.org" },
  ]);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("V0.3 usability persistence", () => {
  it("detects duplicates with evidence, stores favorites and filters by them", async () => {
    const duplicate = await resourcesService.create(ownerA, { name: "Next JS", type: "framework", sourceUrl: "https://www.nextjs.org/?utm_source=x", tags: [], metadata: {} });
    expect(duplicate.warnings).toEqual(["DUPLICATE_SOURCE_URL"]);
    expect(duplicate.duplicates.map((item) => [item.id, item.reason])).toEqual([[nextJs, "url"]]);
    const byName = await resourcesService.create(ownerA, { name: "postgresql", type: "database", tags: [], metadata: {} });
    expect(byName.warnings).toEqual(["DUPLICATE_NAME"]);
    const starred = await resourcesService.update(ownerA, nextJs, { favorite: true });
    expect(starred.resource.favorite).toBe(true);
    const favorites = await resourcesService.list(ownerA, { archived: "active", favorite: "true", limit: 50, offset: 0 });
    expect(favorites.resources.map((item) => item.id)).toEqual([nextJs]);
    const all = await resourcesService.list(ownerA, { archived: "active", limit: 50, offset: 0 });
    expect(all.resources[0]?.id).toBe(nextJs);
    await resourcesService.archive(ownerA, duplicate.resource.id);
    await resourcesService.archive(ownerA, byName.resource.id);
    expect((await resourcesService.list(ownerB, { archived: "active", favorite: "true", limit: 50, offset: 0 })).total).toBe(0);
  });

  it("searches only the owner's entities and ranks name matches first", async () => {
    const { project } = await projectsService.create(ownerA, { name: "Next Finance", stage: "mvp", platforms: ["web"], priorities: [], rules: [], resourceIds: [nextJs, redis] });
    projectId = project.id;
    await profilesService.create(ownerA, { name: "Fast SaaS", type: "stack", description: "Next.js and PostgreSQL by default" });
    const result = await search.search(ownerA, "next", 8);
    expect(result.results.map((item) => [item.kind, item.name, item.archived])).toEqual([
      ["resource", "Next.js", false],
      ["project", "Next Finance", false],
      ["profile", "Fast SaaS", false],
      ["resource", "Next JS", true],
    ]);
    expect(result.results.some((item) => item.name === "Next.js clone")).toBe(false);
    expect((await search.search(ownerB, "next", 8)).results.map((item) => item.name)).toEqual(["Next.js clone"]);
    expect((await search.search(ownerA, "%", 8)).results).toEqual([]);
  });

  it("curates compatibility rules and surfaces them as non-destructive compiler warnings", async () => {
    const rule = await compatibility.create(ownerA, { kind: "conflicts", leftResourceId: redis, rightResourceId: postgres, note: "One data store per MVP." });
    expect(rule.created).toBe(true);
    expect(rule.rule).toMatchObject({ kind: "conflicts", left: { name: "Redis" }, right: { name: "PostgreSQL" }, note: "One data store per MVP." });
    expect((await compatibility.create(ownerA, { kind: "conflicts", leftResourceId: redis, rightResourceId: postgres })).created).toBe(false);
    await compatibility.create(ownerA, { kind: "requires", leftResourceId: nextJs, rightResourceId: postgres });
    for (const [left, right, side] of [[foreign, nextJs, "leftResourceId"], [nextJs, archivedKit, "rightResourceId"]] as const) {
      await expect(compatibility.create(ownerA, { kind: "conflicts", leftResourceId: left, rightResourceId: right }))
        .rejects.toMatchObject({ details: [{ path: [side], code: "resource_unavailable" }] });
    }
    expect((await compatibility.list(ownerA, redis, 100)).map((item) => item.kind)).toEqual(["conflicts"]);
    expect(await compatibility.list(ownerB, undefined, 100)).toEqual([]);

    await decisionsService.upsert(ownerA, projectId, "database.primary", { ...base, mode: "LOCKED", resourceId: postgres });
    const state = await contextService.current(ownerA, projectId);
    expect(state.draftWarnings.map((warning) => warning.code)).toEqual(["RULE_CONFLICT"]);
    expect(state.draftWarnings[0]?.message).toContain("Redis conflicts with PostgreSQL");
    const compiled = await contextService.compile(ownerA, projectId);
    expect(compiled.version.canonical.decisions.map((decision) => decision.slot)).toEqual(["database.primary"]);
    expect(compiled.version.canonical.resources.map((resource) => resource.name)).toEqual(["Next.js", "PostgreSQL", "Redis"]);
    await compatibility.remove(ownerA, rule.rule.id);
    await expect(compatibility.remove(ownerB, rule.rule.id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await database.db.select({ value: count() }).from(compatibilityRules))[0]?.value).toBe(1);
  });

  it("clones a Project completely and idempotently, and saves it as a Profile", async () => {
    const [profile] = (await profilesService.list(ownerA, { archived: "active", limit: 10, offset: 0 })).profiles;
    await projectsService.update(ownerA, projectId, { profiles: [{ profileId: profile!.id, priority: 3 }], rules: ["Keep it boring."] });
    const key = "00000000-0000-4000-8000-000000000099";
    const first = await projectsService.clone(ownerA, projectId, {}, key);
    expect(first.created).toBe(true);
    expect(first.project).toMatchObject({ name: "Copy of Next Finance", status: "active", rules: ["Keep it boring."] });
    expect(first.project.resources.map((item) => item.id).sort()).toEqual([nextJs, redis].sort());
    expect(first.project.profiles.map((item) => [item.id, item.priority])).toEqual([[profile!.id, 3]]);
    expect((await decisionsService.list(ownerA, first.project.id)).find((view) => view.slot === "database.primary")).toMatchObject({ source: "project", effective: { mode: "LOCKED" } });
    const replay = await projectsService.clone(ownerA, projectId, { name: "Ignored on replay" }, key);
    expect(replay.created).toBe(false);
    expect(replay.project.id).toBe(first.project.id);
    const named = await projectsService.clone(ownerA, projectId, { name: "Beacon" });
    expect(named.project.name).toBe("Beacon");
    expect(named.project.slug).toMatch(/^beacon-[a-f0-9]{8}$/);
    expect((await database.db.select({ value: count() }).from(projects))[0]?.value).toBe(3);
    await expect(projectsService.clone(ownerB, projectId, {})).rejects.toMatchObject({ statusCode: 404 });
    expect((await database.db.select({ value: count() }).from(projectResources))[0]?.value).toBe(6);
    expect((await database.db.select({ value: count() }).from(projectProfiles))[0]?.value).toBe(3);
    expect((await database.db.select({ value: count() }).from(projectDecisions))[0]?.value).toBe(3);

    const profileKey = "00000000-0000-4000-8000-000000000098";
    const saved = await profilesService.saveFromProject(ownerA, projectId, { name: "Finance stack", type: "stack" }, profileKey);
    expect(saved.created).toBe(true);
    expect(saved.profile.id).toBe(profileKey);
    expect(saved.profile.decisions.map((decision) => [decision.slot, decision.mode])).toEqual([["database.primary", "LOCKED"]]);
    const savedReplay = await profilesService.saveFromProject(ownerA, projectId, { name: "Finance stack", type: "stack" }, profileKey);
    expect(savedReplay.created).toBe(false);
    expect((await database.db.select({ value: count() }).from(profiles))[0]?.value).toBe(2);
    await expect(profilesService.saveFromProject(ownerB, projectId, { name: "Steal", type: "stack" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("produces a semantic diff between stored versions and keeps history immutable", async () => {
    const only = await contextService.diff(ownerA, projectId, {});
    expect(only.diff).toBeNull();
    expect(only.to?.version).toBe(1);
    await decisionsService.upsert(ownerA, projectId, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs, rationale: "App Router" });
    await database.db.update(resources).set({ name: "Next.js 16" }).where(eq(resources.id, nextJs));
    const second = await contextService.compile(ownerA, projectId);
    expect(second.version.version).toBe(2);
    const diff = await contextService.diff(ownerA, projectId, {});
    expect(diff.from?.version).toBe(1);
    expect(diff.to?.version).toBe(2);
    expect(diff.diff?.decisions).toEqual([expect.objectContaining({ slot: "frontend.framework", kind: "added" })]);
    expect(diff.diff?.resources.added.map((resource) => resource.name)).toEqual([]);
    expect(diff.diff?.unchanged).toBe(false);
    const explicit = await contextService.diff(ownerA, projectId, { from: 1, to: 2 });
    expect(explicit.diff?.decisions).toHaveLength(1);
    await expect(contextService.diff(ownerA, projectId, { from: 1, to: 9 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(contextService.diff(ownerB, projectId, {})).rejects.toMatchObject({ statusCode: 404 });
    expect((await contextService.getVersion(ownerA, projectId, 1)).canonical.resources.find((resource) => resource.id === nextJs)?.name).toBe("Next.js");
  });

  it("summarizes the workspace for onboarding with owner scoping", async () => {
    const summary = await workspace.summary(ownerA);
    expect(summary).toMatchObject({ resources: 3, favorites: 1, projects: 3, profiles: 2, compiledProjects: 1, contextVersions: 2, exports: 0 });
    await contextService.export(ownerA, projectId, { target: "agents" });
    expect((await workspace.summary(ownerA)).exports).toBe(1);
    expect(await workspace.summary(ownerB)).toEqual({ resources: 1, favorites: 0, projects: 0, profiles: 0, compiledProjects: 0, contextVersions: 0, exports: 0 });
  });
});
