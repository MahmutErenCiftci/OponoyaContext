import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, projects, recipes, resources, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { createContextRepository } from "../src/modules/context/repository.js";
import { createContextService, type ContextService } from "../src/modules/context/service.js";
import { createDecisionRepository } from "../src/modules/decisions/repository.js";
import { createDecisionService, type DecisionService } from "../src/modules/decisions/service.js";
import { createProfileRepository } from "../src/modules/profiles/repository.js";
import { createProfileService, type ProfileService } from "../src/modules/profiles/service.js";
import { createProjectRepository } from "../src/modules/projects/repository.js";
import { createProjectService, type ProjectService } from "../src/modules/projects/service.js";
import { createRecipeRepository } from "../src/modules/recipes/repository.js";
import { createRecipeService, type RecipeService } from "../src/modules/recipes/service.js";
import { createResourceRepository } from "../src/modules/resources/repository.js";
import { createResourceService, type ResourceService } from "../src/modules/resources/service.js";

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const nextJs = "00000000-0000-4000-8000-000000000010";
const postgres = "00000000-0000-4000-8000-000000000011";
const redis = "00000000-0000-4000-8000-000000000012";
const foreign = "00000000-0000-4000-8000-000000000020";
const base = { priority: 0, constraints: {}, rationale: null, conditions: {} };

let database: Pick<Database, "db" | "close">;
let resourcesService: ResourceService;
let profilesService: ProfileService;
let recipesService: RecipeService;
let projectsService: ProjectService;
let decisionsService: DecisionService;
let contextService: ContextService;
let stackProfileId = "";
let designProfileId = "";
let foreignProfileId = "";
let recipeId = "";
let projectId = "";

beforeAll(async () => {
  database = await createTestDatabase();
  resourcesService = createResourceService(createResourceRepository(database));
  profilesService = createProfileService(createProfileRepository(database));
  recipesService = createRecipeService(createRecipeRepository(database));
  projectsService = createProjectService(createProjectRepository(database));
  decisionsService = createDecisionService(createDecisionRepository(database));
  contextService = createContextService(createContextRepository(database));
  await database.db.insert(users).values([
    { id: ownerA, email: "a@example.test", name: "Owner A" },
    { id: ownerB, email: "b@example.test", name: "Owner B" },
  ]);
  await database.db.insert(resources).values([
    { id: nextJs, ownerUserId: ownerA, name: "Next.js", slug: "next-js", type: "framework", sourceUrl: "https://nextjs.org" },
    { id: postgres, ownerUserId: ownerA, name: "PostgreSQL", slug: "postgresql", type: "database" },
    { id: redis, ownerUserId: ownerA, name: "Redis", slug: "redis", type: "cache" },
    { id: foreign, ownerUserId: ownerB, name: "Foreign", slug: "foreign", type: "framework" },
  ]);
  await resourcesService.update(ownerA, nextJs, { preference: { slot: "frontend.framework", mode: "PREFERRED" } });
  const stack = await profilesService.create(ownerA, { name: "Stack", type: "stack" });
  stackProfileId = stack.id;
  await profilesService.upsertDecision(ownerA, stackProfileId, "frontend.framework", { ...base, mode: "LOCKED", resourceId: nextJs, rationale: "Team standard" });
  await profilesService.upsertDecision(ownerA, stackProfileId, "database.primary", { ...base, mode: "PREFERRED", resourceId: postgres });
  const design = await profilesService.create(ownerA, { name: "Design", type: "design" });
  designProfileId = design.id;
  await profilesService.upsertDecision(ownerA, designProfileId, "frontend.framework", { ...base, mode: "PREFERRED", resourceId: nextJs });
  foreignProfileId = (await profilesService.create(ownerB, { name: "Foreign profile", type: "stack" })).id;
}, 60_000);

afterAll(async () => { await database.close(); });

describe("Recipes", () => {
  it("creates a Recipe with Profiles and its own decisions, validating attachments and Resources", async () => {
    const recipe = await recipesService.create(ownerA, { name: "SaaS MVP", description: "  Fast start  ", profiles: [{ profileId: stackProfileId, priority: 3 }] });
    recipeId = recipe.id;
    expect(recipe).toMatchObject({ name: "SaaS MVP", description: "Fast start", decisionCount: 0, profileCount: 1, projectCount: 0, archivedAt: null });
    expect(recipe.slug).toMatch(/^saas-mvp-[a-f0-9]{8}$/);
    expect(recipe.profiles).toEqual([expect.objectContaining({ id: stackProfileId, name: "Stack", priority: 3 })]);
    await expect(recipesService.create(ownerA, { name: "Bad", profiles: [{ profileId: foreignProfileId, priority: 0 }] }))
      .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["profiles", "0", "profileId"], code: "profile_unavailable" }] });
    await expect(recipesService.upsertDecision(ownerA, recipeId, "database.cache", { ...base, mode: "DISABLED", resourceId: foreign }))
      .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["resourceId"], code: "resource_unavailable" }] });
    const cache = await recipesService.upsertDecision(ownerA, recipeId, "database.cache", { ...base, mode: "DISABLED", resourceId: redis, rationale: "One data store" });
    expect(cache).toMatchObject({ scope: "recipe", origin: { id: recipeId, name: "SaaS MVP", priority: 0 }, mode: "DISABLED", resource: { name: "Redis" } });
    await recipesService.upsertDecision(ownerA, recipeId, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null, constraints: { allowed: ["Fastify"] } });
    await recipesService.upsertDecision(ownerA, recipeId, "database.primary", { ...base, mode: "LOCKED", resourceId: postgres });
    const loaded = await recipesService.get(ownerA, recipeId);
    expect(loaded.decisions.map((decision) => [decision.slot, decision.mode])).toEqual([["backend.framework", "AI_DECIDE"], ["database.cache", "DISABLED"], ["database.primary", "LOCKED"]]);
    expect(loaded.decisionCount).toBe(3);
    expect((await recipesService.list(ownerA, { archived: "active", limit: 10, offset: 0 })).recipes.map((item) => [item.name, item.decisionCount, item.profileCount])).toEqual([["SaaS MVP", 3, 1]]);
  });

  it("applies the Recipe by reference: Project > Recipe > Profile > Global with the Recipe's Profiles inherited", async () => {
    const created = await projectsService.create(ownerA, { name: "Atlas", stage: "mvp", platforms: ["web"], priorities: [], rules: [], recipeId, profiles: [{ profileId: designProfileId, priority: 9 }] });
    projectId = created.project.id;
    expect(created.project.recipe).toEqual({ id: recipeId, name: "SaaS MVP", slug: expect.any(String), archivedAt: null });
    const views = await decisionsService.list(ownerA, projectId);
    const bySlot = new Map(views.map((view) => [view.slot, view]));
    // Recipe decision beats the Profile's PREFERRED PostgreSQL.
    expect(bySlot.get("database.primary")).toMatchObject({ source: "recipe", effective: { mode: "LOCKED", resource: { name: "PostgreSQL" }, origin: { name: "SaaS MVP" } }, recipe: { mode: "LOCKED" }, profile: { mode: "PREFERRED", origin: { name: "Stack", priority: 3 } } });
    // Directly attached Design profile (priority 9) outranks the Recipe's Stack profile (priority 3) inside the Profile scope; Global stays visible.
    expect(bySlot.get("frontend.framework")).toMatchObject({ source: "profile", effective: { mode: "PREFERRED", origin: { name: "Design", priority: 9 } }, profiles: [expect.objectContaining({ origin: { id: designProfileId, name: "Design", priority: 9 } }), expect.objectContaining({ origin: { id: stackProfileId, name: "Stack", priority: 3 } })], global: { mode: "PREFERRED" }, recipe: null });
    expect(bySlot.get("database.cache")).toMatchObject({ source: "recipe", effective: { mode: "DISABLED", resource: { name: "Redis" } } });
    expect(bySlot.get("backend.framework")).toMatchObject({ source: "recipe", effective: { mode: "AI_DECIDE", constraints: { allowed: ["Fastify"] } } });

    const override = await decisionsService.upsert(ownerA, projectId, "database.primary", { ...base, mode: "LOCKED", resourceId: nextJs, rationale: "Override" });
    expect(override).toMatchObject({ source: "project", effective: { resource: { name: "Next.js" } }, recipe: { mode: "LOCKED", resource: { name: "PostgreSQL" } } });
    expect((await database.db.select({ value: count() }).from(recipes))[0]?.value).toBe(1);
    const restored = await decisionsService.remove(ownerA, projectId, "database.primary");
    expect(restored).toMatchObject({ source: "recipe", project: null });
  });

  it("compiles Recipe decisions with provenance and never copies them into the Project", async () => {
    const compiled = await contextService.compile(ownerA, projectId);
    const decisions = new Map(compiled.version.canonical.decisions.map((decision) => [decision.slot, decision]));
    expect(decisions.get("database.primary")).toMatchObject({ source: "recipe", origin: { id: recipeId, name: "SaaS MVP", priority: 0 }, shadowed: [expect.objectContaining({ scope: "profile", origin: expect.objectContaining({ name: "Stack", priority: 3 }) })] });
    expect(decisions.get("database.cache")).toMatchObject({ source: "recipe", mode: "DISABLED" });
    expect(decisions.get("frontend.framework")).toMatchObject({ source: "profile", origin: { name: "Design", priority: 9 }, shadowed: expect.arrayContaining([expect.objectContaining({ origin: expect.objectContaining({ name: "Stack", priority: 3 }) }), expect.objectContaining({ scope: "global" })]) });
    const agents = compiled.version.previews.find((preview) => preview.target === "agents")!.content;
    expect(agents).toContain('Source: recipe "SaaS MVP"');
    expect(agents).toContain("Do not use Redis");
    expect((await decisionsService.list(ownerA, projectId)).filter((view) => view.project)).toHaveLength(0);

    // Editing the Recipe changes the Project's next compile: inheritance, not a snapshot.
    await recipesService.upsertDecision(ownerA, recipeId, "database.cache", { ...base, mode: "PREFERRED", resourceId: redis });
    const state = await contextService.current(ownerA, projectId);
    expect(state.stale).toBe(true);
    const second = await contextService.compile(ownerA, projectId);
    expect(second.version.canonical.decisions.find((decision) => decision.slot === "database.cache")).toMatchObject({ mode: "PREFERRED", source: "recipe" });
  });

  it("archives Recipes without breaking Projects that apply them, and forbids applying archived or foreign Recipes", async () => {
    await recipesService.archive(ownerA, recipeId);
    expect((await projectsService.get(ownerA, projectId)).recipe?.archivedAt).toEqual(expect.any(String));
    expect((await decisionsService.list(ownerA, projectId)).find((view) => view.slot === "database.cache")?.source).toBe("recipe");
    await expect(projectsService.create(ownerA, { name: "Beta", stage: "mvp", platforms: ["web"], priorities: [], rules: [], recipeId }))
      .rejects.toMatchObject({ statusCode: 400, details: [{ path: ["recipeId"], code: "recipe_unavailable" }] });
    await expect(projectsService.update(ownerB, projectId, { recipeId: null })).rejects.toMatchObject({ statusCode: 404 });
    const otherProject = (await projectsService.create(ownerB, { name: "B project", stage: "mvp", platforms: ["web"], priorities: [], rules: [] })).project;
    await expect(projectsService.update(ownerB, otherProject.id, { recipeId })).rejects.toMatchObject({ statusCode: 400, details: [{ path: ["recipeId"], code: "recipe_unavailable" }] });
    expect((await projectsService.update(ownerA, projectId, { name: "Atlas renamed" })).recipe?.id).toBe(recipeId);
    await recipesService.restore(ownerA, recipeId);
    expect((await projectsService.get(ownerA, projectId)).recipe?.archivedAt).toBeNull();
    const cleared = await projectsService.update(ownerA, projectId, { recipeId: null });
    expect(cleared.recipe).toBeNull();
    expect((await decisionsService.list(ownerA, projectId)).some((view) => view.source === "recipe")).toBe(false);
    const reapplied = await projectsService.update(ownerA, projectId, { recipeId });
    expect(reapplied.recipe?.name).toBe("SaaS MVP");
    expect((await recipesService.get(ownerA, recipeId)).projectCount).toBe(1);
  });

  it("clones the Recipe reference and saves a Project as a new Recipe idempotently", async () => {
    await decisionsService.upsert(ownerA, projectId, "backend.language", { ...base, mode: "LOCKED", resourceId: nextJs });
    const clone = await projectsService.clone(ownerA, projectId, { name: "Atlas clone" });
    expect(clone.project.recipe?.id).toBe(recipeId);
    const key = "00000000-0000-4000-8000-000000000097";
    const saved = await recipesService.saveFromProject(ownerA, projectId, { name: "From Atlas", description: "" }, key);
    expect(saved.created).toBe(true);
    expect(saved.recipe.id).toBe(key);
    expect(saved.recipe.description).toBeNull();
    expect(saved.recipe.decisions.map((decision) => decision.slot)).toEqual(["backend.language"]);
    expect(saved.recipe.profiles.map((item) => [item.id, item.priority])).toEqual([[designProfileId, 9]]);
    const replay = await recipesService.saveFromProject(ownerA, projectId, { name: "Ignored" }, key);
    expect(replay.created).toBe(false);
    expect(replay.recipe.name).toBe("From Atlas");
    await expect(recipesService.saveFromProject(ownerB, projectId, { name: "Steal" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(recipesService.saveFromProject(ownerB, (await projectsService.list(ownerB, { status: "all", limit: 10, offset: 0 })).projects[0]!.id, { name: "Collide" }, key))
      .rejects.toMatchObject({ statusCode: 409 });
    expect((await database.db.select({ value: count() }).from(recipes))[0]?.value).toBe(2);
    expect((await database.db.select({ value: count() }).from(projects))[0]?.value).toBe(3);
  });

  it("isolates owners on every Recipe path", async () => {
    for (const attempt of [
      () => recipesService.get(ownerB, recipeId),
      () => recipesService.update(ownerB, recipeId, { name: "Stolen" }),
      () => recipesService.setProfiles(ownerB, recipeId, []),
      () => recipesService.archive(ownerB, recipeId),
      () => recipesService.restore(ownerB, recipeId),
      () => recipesService.upsertDecision(ownerB, recipeId, "backend.framework", { ...base, mode: "AI_DECIDE", resourceId: null }),
      () => recipesService.removeDecision(ownerB, recipeId, "backend.framework"),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ statusCode: 404 });
    }
    expect((await recipesService.list(ownerB, { archived: "all", limit: 10, offset: 0 })).total).toBe(0);
    await expect(recipesService.setProfiles(ownerA, recipeId, [{ profileId: foreignProfileId, priority: 0 }])).rejects.toMatchObject({ statusCode: 400 });
    const updated = await recipesService.setProfiles(ownerA, recipeId, [{ profileId: stackProfileId, priority: 1 }, { profileId: designProfileId, priority: 2 }]);
    expect(updated.profiles.map((item) => [item.name, item.priority])).toEqual([["Design", 2], ["Stack", 1]]);
    await recipesService.removeDecision(ownerA, recipeId, "backend.framework");
    expect((await recipesService.get(ownerA, recipeId)).decisionCount).toBe(2);
  });
});
