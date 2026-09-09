import { createSampleTransaction } from "../src/modules/samples/transaction.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compatibilityRules, count, eq, globalDecisions, resources, users, workspaceSamples, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createContextService } from "../src/modules/context/service.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService, type DecisionService } from "../src/modules/decisions/service.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService } from "../src/modules/profiles/service.js";
import { createProjectRepository } from "../src/modules/projects/repository.js";
import { createProjectService, type ProjectService } from "../src/modules/projects/service.js";
import { createRecipeRepository } from "../src/modules/recipes/repository.js";
import { createRecipeService } from "../src/modules/recipes/service.js";
import { createResourceRepository } from "../src/modules/resources/repository.js";
import { createResourceService, type ResourceService } from "../src/modules/resources/service.js";
import { sampleSetVersion } from "../src/modules/samples/catalog.js";
import { createSampleService, type SampleService } from "../src/modules/samples/service.js";
import { createWorkspaceRepository, type WorkspaceRepository } from "../src/modules/workspace/repository.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";

let database: Pick<Database, "db" | "close">;
let samples: SampleService;
let workspace: WorkspaceRepository;
let resourcesService: ResourceService;
let projectsService: ProjectService;
let decisionsService: DecisionService;
let ownResourceId = "";

beforeAll(async () => {
  database = await createTestDatabase();
  resourcesService = createResourceService(createResourceRepository(database));


  projectsService = createProjectService(createProjectRepository(database));
  decisionsService = createDecisionService(createDecisionRepository(database));
  workspace = createWorkspaceRepository(database);
  samples = createSampleService(createSampleTransaction(database));
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  ownResourceId = (await resourcesService.create(ownerA, { name: "My own tool", type: "cli", tags: [], metadata: {} })).resource.id;
}, 60_000);

afterAll(async () => { await database.close(); });

describe("optional sample data", () => {
  it.each(["tracking", "profile decision", "settings"])("rolls back a failed %s write and retries the complete install", async (failure) => {
    const owner = crypto.randomUUID();
    await database.db.insert(users).values({ id: owner, email: `${owner}@example.test`, name: "Retry owner" });
    const fail = async (): Promise<never> => { throw new Error("Injected install failure"); };
    const transaction = createSampleTransaction(database);
    const broken = createSampleService((id, work) => transaction(id, (deps) => work({
      ...deps,
      samples: { ...deps.samples, ...(failure === "tracking" ? { record: fail } : {}) },
      profiles: { ...deps.profiles, ...(failure === "profile decision" ? { upsertDecision: fail } : {}) },
      workspace: { ...deps.workspace, ...(failure === "settings" ? { setSamples: fail } : {}) },
    })));
    await expect(broken.install(owner)).rejects.toThrow("Injected install failure");
    expect(await workspace.summary(owner)).toMatchObject({ resources: 0, profiles: 0, projects: 0 });
    expect(await database.db.select().from(workspaceSamples).where(eq(workspaceSamples.ownerUserId, owner))).toHaveLength(0);
    expect((await samples.install(owner)).counts).toEqual({ resources: 8, profiles: 2, recipes: 1, projects: 1, compatibilityRules: 1 });
    const project = (await projectsService.list(owner, { status: "active", limit: 10, offset: 0 })).projects[0]!;
    const compiled = await createContextService(createContextRepository(database)).compile(owner, project.id);
    expect(compiled.version.canonical.warnings).toEqual([]);
    await samples.remove(owner);
  });

  it.each(["attachment", "decision", "profile", "recipe", "global", "compatibility"])("refuses sample removal when a user's %s uses it", async (kind) => {
    const owner = crypto.randomUUID();
    await database.db.insert(users).values({ id: owner, email: `${owner}@example.test`, name: "Own data" });
    await samples.install(owner);
    const records = await database.db.select().from(workspaceSamples).where(eq(workspaceSamples.ownerUserId, owner));
    const resourceId = records.find((row) => row.entityType === "resource")!.entityId;
    const profileId = records.find((row) => row.entityType === "profile")!.entityId;
    const recipeId = records.find((row) => row.entityType === "recipe")!.entityId;
    if (kind !== "global") await database.db.delete(globalDecisions).where(eq(globalDecisions.ownerUserId, owner));
    if (kind === "profile") {
      const service = createProfileService(createProfileRepository(database));
      const own = await service.create(owner, { name: "My profile", type: "stack" });
      await service.upsertDecision(owner, own.id, "custom.tool", { mode: "LOCKED", resourceId, priority: 0, constraints: {}, rationale: null, conditions: {} });
    } else if (kind === "recipe") {
      await createRecipeService(createRecipeRepository(database)).create(owner, { name: "My recipe", profiles: [{ profileId, priority: 0 }] });
    } else if (kind === "compatibility") {
      const own = (await resourcesService.create(owner, { name: "My tool", type: "cli", tags: [], metadata: {} })).resource;
      await database.db.insert(compatibilityRules).values({ ownerUserId: owner, leftResourceId: own.id, rightResourceId: resourceId, kind: "requires" });
    } else {
      const own = await projectsService.create(owner, { name: "My project", stage: "mvp", platforms: ["web"], priorities: [], rules: [], ...(kind === "attachment" ? { resourceIds: [resourceId], recipeId } : {}) });
      if (kind === "decision") await decisionsService.upsert(owner, own.project.id, "custom.tool", { mode: "LOCKED", resourceId, priority: 0, constraints: {}, rationale: null, conditions: {} });
    }
    const before = await workspace.summary(owner);
    await expect(samples.remove(owner)).rejects.toMatchObject({ statusCode: 409, details: [{ path: ["samples"], code: "samples_in_use" }] });
    expect(await workspace.summary(owner)).toEqual(before);
    expect(await database.db.select().from(workspaceSamples).where(eq(workspaceSamples.ownerUserId, owner))).toHaveLength(13);
    expect((await workspace.settings(owner)).sampleVersion).toBe(sampleSetVersion);
  });

  it("does not overwrite an existing Library preference during sample installation", async () => {
    const owner = crypto.randomUUID();
    await database.db.insert(users).values({ id: owner, email: `${owner}@example.test`, name: "Existing stack" });
    const own = (await resourcesService.create(owner, { name: "My frontend", type: "framework", tags: [], metadata: {}, preference: { slot: "frontend.framework", mode: "LOCKED" } })).resource;
    await samples.install(owner);
    expect((await resourcesService.get(owner, own.id)).preference).toMatchObject({ slot: "frontend.framework", mode: "LOCKED" });
  });

  it("installs a versioned, recognizable sample set idempotently and marks onboarding", async () => {
    expect((await workspace.settings(ownerA))).toMatchObject({ onboardingState: "new", sampleVersion: null });
    const first = await samples.install(ownerA);
    expect(first.created).toBe(true);
    expect(first.counts).toEqual({ resources: 8, profiles: 2, recipes: 1, projects: 1, compatibilityRules: 1 });
    expect(first.settings).toMatchObject({ onboardingState: "in_progress", onboardingChoice: "samples", sampleVersion: sampleSetVersion, currentSampleVersion: sampleSetVersion });
    expect(first.settings.sampleInstalledAt).toEqual(expect.any(String));
    const listed = await resourcesService.list(ownerA, { archived: "active", limit: 50, offset: 0 });
    expect(listed.total).toBe(9);
    expect(listed.resources.filter((resource) => resource.name.startsWith("Sample ·"))).toHaveLength(8);
    expect(listed.resources.find((resource) => resource.name.includes("Next.js"))?.preference).toMatchObject({ slot: "frontend.framework", mode: "PREFERRED" });
    const project = (await projectsService.list(ownerA, { status: "active", limit: 10, offset: 0 })).projects[0]!;
    expect(project.name).toBe("Sample · Atlas Finance");
    expect(project.recipe?.name).toBe("Sample · SaaS MVP");
    const views = await decisionsService.list(ownerA, project.id);
    expect(views.find((view) => view.slot === "database.cache")).toMatchObject({ source: "recipe", effective: { mode: "DISABLED" } });
    expect(views.find((view) => view.slot === "frontend.framework")).toMatchObject({ source: "profile", effective: { mode: "LOCKED", origin: { name: "Sample · Fast SaaS stack", priority: 10 } } });
    expect(views.find((view) => view.slot === "backend.architecture")).toMatchObject({ source: "project", effective: { mode: "AI_DECIDE" } });
    const compiled = await createContextService(createContextRepository(database)).compile(ownerA, project.id);
    expect(compiled.version.canonical.warnings).toEqual([]);
    expect(compiled.version.previews.find((preview) => preview.target === "claude")?.content).toContain("Do not use Sample · Redis");

    const again = await samples.install(ownerA);
    expect(again.created).toBe(false);
    expect(again.counts).toEqual({ resources: 0, profiles: 0, recipes: 0, projects: 0, compatibilityRules: 0 });
    expect((await database.db.select({ value: count() }).from(workspaceSamples).where(eq(workspaceSamples.ownerUserId, ownerA)))[0]?.value).toBe(13);
    expect((await workspace.summary(ownerA))).toMatchObject({ resources: 9, projects: 1, profiles: 2 });
    expect((await workspace.summary(ownerB))).toMatchObject({ resources: 0, projects: 0, profiles: 0 });
  });

  it("removes exactly the installed samples and keeps the user's own data", async () => {
    const removed = await samples.remove(ownerA);
    expect(removed.removed).toEqual({ resources: 8, profiles: 2, recipes: 1, projects: 1, compatibilityRules: 1 });
    expect(removed.settings).toMatchObject({ sampleVersion: null, sampleInstalledAt: null, onboardingState: "in_progress" });
    expect((await database.db.select({ value: count() }).from(workspaceSamples).where(eq(workspaceSamples.ownerUserId, ownerA)))[0]?.value).toBe(0);
    expect((await database.db.select({ value: count() }).from(compatibilityRules).where(eq(compatibilityRules.ownerUserId, ownerA)))[0]?.value).toBe(0);
    const listed = await resourcesService.list(ownerA, { archived: "all", limit: 50, offset: 0 });
    expect(listed.resources.map((resource) => resource.id)).toEqual([ownResourceId]);
    expect((await workspace.summary(ownerA))).toMatchObject({ resources: 1, projects: 0, profiles: 0 });
    expect((await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerA)))[0]?.value).toBe(1);
    const reinstalled = await samples.install(ownerA);
    expect(reinstalled.created).toBe(true);
    expect(reinstalled.counts.resources).toBe(8);
    const emptyRemoval = await samples.remove(ownerB);
    expect(emptyRemoval.removed).toEqual({ resources: 0, profiles: 0, recipes: 0, projects: 0, compatibilityRules: 0 });
  });
});
