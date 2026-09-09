import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contextVersions, count, projects, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createAuditRepository, type AuditRepository } from "../src/modules/audit/repository.js";
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
const foreignResource = "00000000-0000-4000-8000-000000000020";
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
let audit: AuditRepository;
let projectId = "";
let profileId = "";
let ruleId = "";
let projectB = "";

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
  audit = createAuditRepository(database);
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(resources).values([
    { id: nextJs, ownerUserId: ownerA, name: "Next.js", slug: "next-js", type: "framework", notes: "owner-a-private-notes" },
    { id: postgres, ownerUserId: ownerA, name: "PostgreSQL", slug: "postgresql", type: "database" },
    { id: foreignResource, ownerUserId: ownerB, name: "Foreign", slug: "foreign", type: "framework" },
  ]);
  const project = await projectsService.create(ownerA, { name: "Atlas Private", stage: "mvp", platforms: ["web"], priorities: [], rules: ["Owner A rule"], resourceIds: [nextJs] });
  projectId = project.project.id;
  await decisionsService.upsert(ownerA, projectId, "database.primary", { ...base, mode: "LOCKED", resourceId: postgres });
  const profile = await profilesService.create(ownerA, { name: "Owner A stack", type: "stack" });
  profileId = profile.id;
  await profilesService.upsertDecision(ownerA, profileId, "frontend.framework", { ...base, mode: "PREFERRED", resourceId: nextJs });
  await projectsService.update(ownerA, projectId, { profiles: [{ profileId, priority: 1 }] });
  const rule = await compatibility.create(ownerA, { kind: "requires", leftResourceId: nextJs, rightResourceId: postgres });
  ruleId = rule.rule.id;
  await contextService.compile(ownerA, projectId);
  await contextService.export(ownerA, projectId, { target: "agents" });
  await audit.record({ actorUserId: ownerA, action: "project.compiled", entityType: "project", entityId: projectId, metadata: { version: 1 }, requestId: "req-a" });
  projectB = (await projectsService.create(ownerB, { name: "Owner B project", stage: "mvp", platforms: ["web"], priorities: [], rules: [] })).project.id;
}, 60_000);

afterAll(async () => { await database.close(); });

type Attempt = { name: string; run(): Promise<unknown> };

describe("cross-user isolation matrix", () => {
  it("hides every owner-A entity from owner B on every read and mutation path", async () => {
    const attempts: Attempt[] = [
      { name: "resource get", run: () => resourcesService.get(ownerB, nextJs) },
      { name: "resource update", run: () => resourcesService.update(ownerB, nextJs, { name: "Stolen" }) },
      { name: "resource archive", run: () => resourcesService.archive(ownerB, nextJs) },
      { name: "resource restore", run: () => resourcesService.restore(ownerB, nextJs) },
      { name: "project get", run: () => projectsService.get(ownerB, projectId) },
      { name: "project update", run: () => projectsService.update(ownerB, projectId, { name: "Stolen" }) },
      { name: "project archive", run: () => projectsService.archive(ownerB, projectId) },
      { name: "project restore", run: () => projectsService.restore(ownerB, projectId) },
      { name: "project clone", run: () => projectsService.clone(ownerB, projectId, {}) },
      { name: "decisions list", run: () => decisionsService.list(ownerB, projectId) },
      { name: "decision upsert", run: () => decisionsService.upsert(ownerB, projectId, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null }) },
      { name: "decision remove", run: () => decisionsService.remove(ownerB, projectId, "database.primary") },
      { name: "decision batch", run: () => decisionsService.batch(ownerB, projectId, { decisions: [], removeSlots: ["database.primary"] }) },
      { name: "profile get", run: () => profilesService.get(ownerB, profileId) },
      { name: "profile update", run: () => profilesService.update(ownerB, profileId, { name: "Stolen" }) },
      { name: "profile archive", run: () => profilesService.archive(ownerB, profileId) },
      { name: "profile restore", run: () => profilesService.restore(ownerB, profileId) },
      { name: "profile decision upsert", run: () => profilesService.upsertDecision(ownerB, profileId, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null }) },
      { name: "profile decision remove", run: () => profilesService.removeDecision(ownerB, profileId, "frontend.framework") },
      { name: "save as profile", run: () => profilesService.saveFromProject(ownerB, projectId, { name: "Stolen", type: "stack" }) },
      { name: "context current", run: () => contextService.current(ownerB, projectId) },
      { name: "context compile", run: () => contextService.compile(ownerB, projectId) },
      { name: "context versions", run: () => contextService.listVersions(ownerB, projectId) },
      { name: "context version", run: () => contextService.getVersion(ownerB, projectId, 1) },
      { name: "context export", run: () => contextService.export(ownerB, projectId, { target: "agents" }) },
      { name: "context exports", run: () => contextService.listExports(ownerB, projectId) },
      { name: "context diff", run: () => contextService.diff(ownerB, projectId, {}) },
      { name: "rule remove", run: () => compatibility.remove(ownerB, ruleId) },
    ];
    for (const attempt of attempts) {
      await expect(attempt.run(), attempt.name).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(await compatibility.list(ownerB, nextJs, 100)).toEqual([]);
    expect((await search.search(ownerB, "Atlas", 8)).results).toEqual([]);
    expect((await search.search(ownerB, "Owner A", 8)).results).toEqual([]);
    expect((await resourcesService.list(ownerB, { archived: "all", limit: 50, offset: 0 })).resources.map((item) => item.id)).toEqual([foreignResource]);
    expect((await projectsService.list(ownerB, { status: "all", limit: 50, offset: 0 })).projects.map((item) => item.id)).toEqual([projectB]);
    expect((await profilesService.list(ownerB, { archived: "all", limit: 50, offset: 0 })).total).toBe(0);
    expect(await decisionsService.listGlobal(ownerB)).toEqual([]);
    expect(await workspace.summary(ownerB)).toEqual({ resources: 1, favorites: 0, projects: 1, profiles: 0, compiledProjects: 0, contextVersions: 0, exports: 0 });
    expect(await audit.list(ownerB, { limit: 20 })).toEqual([]);
    expect(await audit.list(ownerB, { entityId: projectId, limit: 20 })).toEqual([]);
  });

  it("refuses to link owner-A resources or profiles into owner-B entities and reports positions only", async () => {
    await expect(projectsService.update(ownerB, projectB, { resourceIds: [nextJs] })).rejects.toMatchObject({ statusCode: 400, details: [{ path: ["resourceIds", "0"], code: "resource_unavailable" }] });
    await expect(projectsService.update(ownerB, projectB, { profiles: [{ profileId, priority: 0 }] })).rejects.toMatchObject({ statusCode: 400, details: [{ path: ["profiles", "0", "profileId"], code: "profile_unavailable" }] });
    await expect(decisionsService.upsert(ownerB, projectB, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs })).rejects.toMatchObject({ statusCode: 400, details: [{ path: ["resourceId"], code: "resource_unavailable" }] });
    await expect(compatibility.create(ownerB, { kind: "conflicts", leftResourceId: foreignResource, rightResourceId: nextJs })).rejects.toMatchObject({ statusCode: 400, details: [{ path: ["rightResourceId"], code: "resource_unavailable" }] });
    await expect(profilesService.saveFromProject(ownerB, projectB, { name: "Collide", type: "stack" }, profileId)).rejects.toMatchObject({ statusCode: 409, details: [{ path: ["idempotency-key"], code: "idempotency_key_in_use" }] });
    expect((await database.db.select({ value: count() }).from(projects))[0]?.value).toBe(2);
    expect((await profilesService.get(ownerA, profileId)).name).toBe("Owner A stack");
  });

  it("serializes concurrent compiles, exports and idempotent creates", async () => {
    await decisionsService.upsert(ownerA, projectId, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null });
    const compiles = await Promise.all(Array.from({ length: 5 }, () => contextService.compile(ownerA, projectId)));
    expect(compiles.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(compiles.map((result) => result.version.version)).size).toBe(1);
    expect((await database.db.select({ value: count() }).from(contextVersions))[0]?.value).toBe(2);
    const key = "00000000-0000-4000-8000-000000000099";
    const exports = await Promise.all(Array.from({ length: 5 }, () => contextService.export(ownerA, projectId, { target: "claude" }, key)));
    expect(exports.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(exports.map((result) => result.event.id)).size).toBe(1);
    const creates = await Promise.all(Array.from({ length: 5 }, () => projectsService.create(ownerA, { name: "Burst", stage: "mvp", platforms: ["web"], priorities: [], rules: [] }, key)));
    expect(creates.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(creates.map((result) => result.project.id)).size).toBe(1);
    const clones = await Promise.all(Array.from({ length: 4 }, () => projectsService.clone(ownerA, projectId, { name: "Burst clone" }, "00000000-0000-4000-8000-000000000098")));
    expect(clones.filter((result) => result.created)).toHaveLength(1);
    expect((await database.db.select({ value: count() }).from(projects))[0]?.value).toBe(4);
  });
});
