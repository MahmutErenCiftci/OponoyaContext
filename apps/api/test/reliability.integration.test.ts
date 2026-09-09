import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditEvents, contextVersions, count, createDatabase, exportEvents, profiles, projects, resources, users, type Database } from "@devcontext/db";
import { readDatabaseUrl } from "@devcontext/db/config";
import { createScratchDatabase, type ScratchDatabase } from "@devcontext/db/testing";
import { createAuditRepository } from "../src/modules/audit/repository.js";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createContextService, type ContextService } from "../src/modules/context/service.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService } from "../src/modules/decisions/service.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService, type ProfileService } from "../src/modules/profiles/service.js";
import { createProjectRepository } from "../src/modules/projects/repository.js";
import { createProjectService, type ProjectService } from "../src/modules/projects/service.js";
import { createSampleService } from "../src/modules/samples/service.js";
import { createSampleTransaction } from "../src/modules/samples/transaction.js";
import { createPortabilityRepository } from "../src/modules/portability/repository.js";
import { createPortabilityService } from "../src/modules/portability/service.js";

/**
 * Real-PostgreSQL concurrency evidence: the PGlite suites run on a single
 * connection, so only a server with a connection pool proves the row locks and
 * unique-key replays hold under parallel requests. Runs on a scratch database.
 */
const owner = crypto.randomUUID();
const resourceId = crypto.randomUUID();
const base = { priority: 0, constraints: {}, rationale: null, conditions: {} };

let scratch: ScratchDatabase;
let database: Database;
let projectsService: ProjectService;
let contextService: ContextService;
let profilesService: ProfileService;
let projectId = "";

beforeAll(async () => {
  scratch = await createScratchDatabase(readDatabaseUrl());
  database = createDatabase(scratch.url);
  projectsService = createProjectService(createProjectRepository(database));
  contextService = createContextService(createContextRepository(database));
  profilesService = createProfileService(createProfileRepository(database));
  await database.db.insert(users).values({ id: owner, email: `${owner}@example.test`, name: "Concurrency Owner" });
  await database.db.insert(resources).values({ id: resourceId, ownerUserId: owner, name: "PostgreSQL", slug: "postgresql", type: "database" });
  projectId = (await projectsService.create(owner, { name: "Parallel", stage: "mvp", platforms: ["web"], priorities: [], rules: [] })).project.id;
  await createDecisionService(createDecisionRepository(database)).upsert(owner, projectId, "database.primary", { ...base, mode: "LOCKED", resourceId });
}, 60_000);

afterAll(async () => {
  await database.close();
  await scratch.drop();
});

describe("parallel requests on PostgreSQL", () => {
  it("serializes sample installation and removal across pooled connections", async () => {
    const sampleOwner = crypto.randomUUID();
    await database.db.insert(users).values({ id: sampleOwner, email: `${sampleOwner}@example.test`, name: "Sample concurrency" });
    const samples = createSampleService(createSampleTransaction(database));
    const installs = await Promise.all(Array.from({ length: 8 }, () => samples.install(sampleOwner)));
    expect(installs.filter((result) => result.created)).toHaveLength(1);
    expect(installs.reduce((total, result) => total + result.counts.resources, 0)).toBe(8);
    const portability = createPortabilityService(createPortabilityRepository(database));
    const document = await portability.exportWorkspace(sampleOwner);
    expect(document).toMatchObject({ resources: expect.any(Array), projects: expect.any(Array) });
    expect(document.resources).toHaveLength(8);
    expect(document.profiles).toHaveLength(2);
    expect(document.projects).toHaveLength(1);
    const removals = await Promise.all(Array.from({ length: 8 }, () => samples.remove(sampleOwner)));
    expect(removals.reduce((total, result) => total + result.removed.resources, 0)).toBe(8);
    expect((await portability.exportWorkspace(sampleOwner)).resources).toHaveLength(0);
  });

  it("stores exactly one context version for concurrent compiles", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => contextService.compile(owner, projectId)));
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.version.contentHash)).size).toBe(1);
    expect((await database.db.select({ value: count() }).from(contextVersions))[0]?.value).toBe(1);
  });

  it("records one export event for a replayed idempotency key", async () => {
    const key = crypto.randomUUID();
    const results = await Promise.all(Array.from({ length: 8 }, () => contextService.export(owner, projectId, { target: "agents" }, key)));
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.event.id)).size).toBe(1);
    expect((await database.db.select({ value: count() }).from(exportEvents))[0]?.value).toBe(1);
  });

  it("creates, clones and saves-as-profile exactly once per idempotency key", async () => {
    const createKey = crypto.randomUUID();
    const creates = await Promise.all(Array.from({ length: 8 }, () => projectsService.create(owner, { name: "Burst", stage: "mvp", platforms: ["web"], priorities: [], rules: [] }, createKey)));
    expect(creates.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(creates.map((result) => result.project.id)).size).toBe(1);
    const cloneKey = crypto.randomUUID();
    const clones = await Promise.all(Array.from({ length: 8 }, () => projectsService.clone(owner, projectId, { name: "Clone burst" }, cloneKey)));
    expect(clones.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(clones.map((result) => result.project.id)).size).toBe(1);
    expect((await database.db.select({ value: count() }).from(projects))[0]?.value).toBe(3);
    const profileKey = crypto.randomUUID();
    const saves = await Promise.all(Array.from({ length: 8 }, () => profilesService.saveFromProject(owner, projectId, { name: "Burst profile", type: "stack" }, profileKey)));
    expect(saves.filter((result) => result.created)).toHaveLength(1);
    expect((await database.db.select({ value: count() }).from(profiles))[0]?.value).toBe(1);
  });

  it("appends concurrent audit events without loss", async () => {
    const audit = createAuditRepository(database);
    await Promise.all(Array.from({ length: 20 }, (_, index) => audit.record({ actorUserId: owner, action: "project.decision_changed", entityType: "project", entityId: projectId, metadata: { slot: `custom.slot_${index}` }, requestId: `req-${index}` })));
    expect((await database.db.select({ value: count() }).from(auditEvents))[0]?.value).toBe(20);
    expect((await audit.list(owner, { entityId: projectId, limit: 100 })).length).toBe(20);
  });
});
