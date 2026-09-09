import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { apiErrorSchema, importResponseSchema, recipeListResponseSchema, recipeResponseSchema, sampleInstallResponseSchema, workspaceSettingsResponseSchema, type ImportSummary, type PortableDocument, type Recipe, type WorkspaceSettings } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import type { PortabilityService } from "../src/modules/portability/service.js";
import type { RecipeService } from "../src/modules/recipes/service.js";
import type { SampleService } from "../src/modules/samples/service.js";
import type { WorkspaceRepository } from "../src/modules/workspace/repository.js";
import { memoryAudit } from "./support/memory-audit.js";
import { unlimitedEntitlements } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const now = new Date().toISOString();
const emptyDocument: PortableDocument = { format: "devcontext", version: 1, exportedAt: now, resources: [], profiles: [], recipes: [], projects: [], compatibilityRules: [] };
const summary: ImportSummary = {
  strategy: "skip", dryRun: true,
  counts: { resources: { create: 2, skip: 1, replace: 0, copy: 0 }, profiles: { create: 0, skip: 0, replace: 0, copy: 0 }, recipes: { create: 0, skip: 0, replace: 0, copy: 0 }, projects: { create: 1, skip: 0, replace: 0, copy: 0 }, compatibilityRules: { create: 0, skip: 0, replace: 0, copy: 0 } },
  items: [{ type: "resource", ref: "r1", name: "Next.js", action: "create", reason: null }], warnings: [],
};
const settings: WorkspaceSettings = { onboardingState: "new", onboardingChoice: null, sampleVersion: null, sampleInstalledAt: null, currentSampleVersion: "1" };
const recipe: Recipe = { id: "00000000-0000-4000-8000-000000000075", name: "SaaS MVP", slug: "saas-mvp-00000000", description: null, decisionCount: 0, profileCount: 0, projectCount: 0, archivedAt: null, createdAt: now, updatedAt: now, profiles: [], decisions: [] };

function auth(): AuthProvider {
  return {
    async handler() { return new Response(); },
    async getSession(headers) {
      const match = /session=(owner-a|owner-b)/.exec(headers.get("cookie") ?? "");
      if (!match?.[1]) return null;
      return { user: { id: match[1] === "owner-a" ? ownerA : ownerB, email: `${match[1]}@example.test`, name: match[1], image: null } };
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
  };
}

function notFound() {
  return Object.assign(new Error("Not found"), { statusCode: 404 });
}

function portability(): PortabilityService {
  return {
    exportWorkspace: vi.fn(async (ownerUserId) => ({ ...emptyDocument, resources: ownerUserId === ownerA ? [{ ref: "r1", name: "Next.js", type: "framework" as const, description: null, sourceUrl: null, docsUrl: null, repoUrl: null, installCommand: null, notes: null, metadata: {}, tags: [], favorite: false, archived: false, preference: null }] : [] })),
    importWorkspace: vi.fn(async (_ownerUserId, request, idempotencyKey) => {
      const document = request.document as { version?: number };
      if (document.version === 2) throw Object.assign(new Error("Import document is invalid"), { statusCode: 400, details: [{ path: ["document", "version"], code: "unsupported_version" }], publicMessage: "This file uses DevContext export version 2, which is newer than this app supports (version 1). Update the app before importing it." });
      const replay = idempotencyKey === "00000000-0000-4000-8000-000000000096";
      return { summary: { ...summary, strategy: request.strategy, dryRun: request.dryRun }, applied: !request.dryRun, created: !request.dryRun && !replay };
    }),
  };
}

function recipes(): RecipeService {
  const guard = (ownerUserId: string) => { if (ownerUserId !== ownerA) throw notFound(); };
  return {
    list: vi.fn(async (ownerUserId) => ({ recipes: ownerUserId === ownerA ? [recipe] : [], total: ownerUserId === ownerA ? 1 : 0 })),
    get: vi.fn(async (ownerUserId) => { guard(ownerUserId); return recipe; }),
    create: vi.fn(async () => recipe),
    update: vi.fn(async (ownerUserId) => { guard(ownerUserId); return recipe; }),
    setProfiles: vi.fn(async (ownerUserId) => { guard(ownerUserId); return recipe; }),
    archive: vi.fn(async (ownerUserId) => { guard(ownerUserId); return { ...recipe, archivedAt: now }; }),
    restore: vi.fn(async (ownerUserId) => { guard(ownerUserId); return recipe; }),
    upsertDecision: vi.fn(async (ownerUserId) => { guard(ownerUserId); return { id: "00000000-0000-4000-8000-000000000081", scope: "recipe" as const, origin: { id: recipe.id, name: recipe.name, priority: 0 }, slot: "backend.framework", mode: "AI_DECIDE" as const, resource: null, priority: 0, constraints: {}, rationale: null, conditions: {}, updatedAt: now }; }),
    removeDecision: vi.fn(async (ownerUserId) => { guard(ownerUserId); }),
    saveFromProject: vi.fn(async (ownerUserId, _projectId, _input, idempotencyKey) => { guard(ownerUserId); return { recipe, created: idempotencyKey !== "00000000-0000-4000-8000-000000000098" }; }),
  };
}

function samples(): SampleService {
  let installed = false;
  return {
    install: vi.fn(async () => { const created = !installed; installed = true; return { settings: { ...settings, onboardingState: "in_progress" as const, onboardingChoice: "samples" as const, sampleVersion: "1", sampleInstalledAt: now }, created, counts: { resources: created ? 8 : 0, profiles: created ? 2 : 0, recipes: created ? 1 : 0, projects: created ? 1 : 0, compatibilityRules: created ? 1 : 0 } }; }),
    remove: vi.fn(async () => ({ settings, removed: { resources: 8, profiles: 2, recipes: 1, projects: 1, compatibilityRules: 1 } })),
  };
}

function workspace(): WorkspaceRepository {
  let state: WorkspaceSettings["onboardingState"] = "new";
  return {
    summary: vi.fn(async () => ({ resources: 0, favorites: 0, projects: 0, profiles: 0, compiledProjects: 0, contextVersions: 0, exports: 0 })),
    settings: vi.fn(async () => ({ onboardingState: state, onboardingChoice: null, sampleVersion: null, sampleInstalledAt: null })),
    updateOnboarding: vi.fn(async (_ownerUserId, next) => { state = next; return { onboardingState: state, onboardingChoice: null, sampleVersion: null, sampleInstalledAt: null }; }),
    setSamples: vi.fn(async () => ({ onboardingState: state, onboardingChoice: null, sampleVersion: "1", sampleInstalledAt: now })),
  };
}

async function createApp() {
  const dependencies = { auth: auth(), portability: portability(), recipes: recipes(), samples: samples(), workspace: workspace(), audit: memoryAudit(), entitlements: unlimitedEntitlements() };
  const app = await buildApp(readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }), dependencies);
  apps.push(app);
  return { app, ...dependencies };
}

const headers = { cookie: "session=owner-a" };

describe("portability, recipes, samples and settings routes", () => {
  it("accepts imports above 1 MiB without raising the limit on other routes", async () => {
    const { app } = await createApp();
    const document = { ...emptyDocument, padding: "ş".repeat(600_000) };
    expect((await app.inject({ method: "POST", url: "/v1/workspace/import", headers, payload: { document } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/resources", headers, payload: { padding: document.padding } })).statusCode).toBe(413);
  });

  it("returns an actionable conflict without recording a removal when samples are in use", async () => {
    const { app, samples, audit } = await createApp();
    vi.mocked(samples.remove).mockRejectedValueOnce(Object.assign(new Error("Samples are in use"), { statusCode: 409, publicMessage: "Sample data is used by your projects. Nothing was deleted.", details: [{ path: ["samples"], code: "samples_in_use" }] }));
    const response = await app.inject({ method: "DELETE", url: "/v1/workspace/samples", headers });
    expect(response.statusCode).toBe(409);
    expect(apiErrorSchema.parse(response.json()).error).toMatchObject({ message: expect.stringContaining("Nothing was deleted"), details: [{ path: ["samples"], code: "samples_in_use" }] });
    expect(audit.events).toHaveLength(0);
  });

  it("downloads the export as an attachment and audits it without content", async () => {
    const { app, audit } = await createApp();
    expect((await app.inject("/v1/workspace/export")).statusCode).toBe(401);
    const response = await app.inject({ url: "/v1/workspace/export", headers });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.headers["content-disposition"]).toMatch(/^attachment; filename="devcontext-export-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(JSON.parse(response.body)).toMatchObject({ format: "devcontext", version: 1, resources: [{ name: "Next.js" }] });
    expect(audit.events).toEqual([expect.objectContaining({ action: "workspace.export_downloaded", metadata: { resources: 1, profiles: 0, recipes: 0, projects: 0 } })]);
    expect(JSON.stringify(audit.events)).not.toContain("Next.js");
  });

  it("previews, applies and replays imports with explicit version errors", async () => {
    const { app, portability, audit } = await createApp();
    const preview = await app.inject({ method: "POST", url: "/v1/workspace/import", headers, payload: { document: emptyDocument } });
    expect(preview.statusCode).toBe(200);
    expect(importResponseSchema.parse(preview.json())).toMatchObject({ applied: false, created: false, summary: { dryRun: true, strategy: "skip" } });
    expect(portability.importWorkspace).toHaveBeenLastCalledWith(ownerA, { document: emptyDocument, strategy: "skip", dryRun: true }, undefined);
    expect(audit.events).toHaveLength(0);

    const key = "00000000-0000-4000-8000-000000000095";
    const applied = await app.inject({ method: "POST", url: "/v1/workspace/import", headers: { ...headers, "idempotency-key": key }, payload: { document: emptyDocument, strategy: "copy", dryRun: false } });
    expect(applied.statusCode).toBe(201);
    expect(importResponseSchema.parse(applied.json())).toMatchObject({ applied: true, created: true, summary: { strategy: "copy", dryRun: false } });
    expect(portability.importWorkspace).toHaveBeenLastCalledWith(ownerA, { document: emptyDocument, strategy: "copy", dryRun: false }, key);
    expect(audit.events).toEqual([expect.objectContaining({ action: "workspace.import_completed", metadata: { strategy: "copy", created: 3, skipped: 1, replaced: 0, copied: 0 } })]);
    expect(JSON.stringify(audit.events)).not.toContain("Next.js");

    const replayed = await app.inject({ method: "POST", url: "/v1/workspace/import", headers: { ...headers, "idempotency-key": "00000000-0000-4000-8000-000000000096" }, payload: { document: emptyDocument, dryRun: false } });
    expect(replayed.statusCode).toBe(200);
    expect(importResponseSchema.parse(replayed.json()).created).toBe(false);
    expect(audit.events).toHaveLength(1);

    const future = await app.inject({ method: "POST", url: "/v1/workspace/import", headers, payload: { document: { ...emptyDocument, version: 2 }, dryRun: false } });
    expect(future.statusCode).toBe(400);
    const error = apiErrorSchema.parse(future.json()).error;
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toContain("version 2");
    expect(error.details).toEqual([{ path: ["document", "version"], code: "unsupported_version" }]);
    expect((await app.inject({ method: "POST", url: "/v1/workspace/import", headers, payload: { document: emptyDocument, strategy: "merge" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/workspace/import", headers: { ...headers, "idempotency-key": "nope" }, payload: { document: emptyDocument } })).statusCode).toBe(400);
  });

  it("exposes Recipe CRUD, decisions and save-as-recipe with owner scoping", async () => {
    const { app, recipes, audit } = await createApp();
    expect((await app.inject("/v1/recipes")).statusCode).toBe(401);
    expect(recipeListResponseSchema.parse((await app.inject({ url: "/v1/recipes?archived=all&limit=5", headers })).json()).total).toBe(1);
    expect(recipes.list).toHaveBeenCalledWith(ownerA, expect.objectContaining({ archived: "all", limit: 5 }));
    const created = await app.inject({ method: "POST", url: "/v1/recipes", headers, payload: { name: "SaaS MVP", profiles: [{ profileId: "00000000-0000-4000-8000-000000000070", priority: 2 }] } });
    expect(created.statusCode).toBe(201);
    expect(recipeResponseSchema.parse(created.json()).recipe.name).toBe("SaaS MVP");
    expect((await app.inject({ method: "POST", url: "/v1/recipes", headers, payload: { name: "" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/v1/recipes/${recipe.id}`, headers, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: `/v1/recipes/${recipe.id}/profiles`, headers, payload: { profiles: [] } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: `/v1/recipes/${recipe.id}/decisions/backend.framework`, headers, payload: { mode: "AI_DECIDE" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PUT", url: `/v1/recipes/${recipe.id}/decisions/Bad Slot`, headers, payload: { mode: "AI_DECIDE" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: `/v1/recipes/${recipe.id}/decisions/backend.framework`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/v1/recipes/${recipe.id}`, headers })).json().recipe.archivedAt).toBe(now);
    expect((await app.inject({ method: "POST", url: `/v1/recipes/${recipe.id}/restore`, headers })).statusCode).toBe(200);
    const saved = await app.inject({ method: "POST", url: "/v1/projects/00000000-0000-4000-8000-000000000030/save-as-recipe", headers, payload: { name: "From project" } });
    expect(saved.statusCode).toBe(201);
    const replay = await app.inject({ method: "POST", url: "/v1/projects/00000000-0000-4000-8000-000000000030/save-as-recipe", headers: { ...headers, "idempotency-key": "00000000-0000-4000-8000-000000000098" }, payload: { name: "From project" } });
    expect(replay.statusCode).toBe(200);
    for (const request of [
      { method: "GET" as const, url: `/v1/recipes/${recipe.id}` },
      { method: "PATCH" as const, url: `/v1/recipes/${recipe.id}`, payload: { name: "Hijack" } },
      { method: "PUT" as const, url: `/v1/recipes/${recipe.id}/decisions/backend.framework`, payload: { mode: "AI_DECIDE" } },
      { method: "DELETE" as const, url: `/v1/recipes/${recipe.id}` },
      { method: "POST" as const, url: "/v1/projects/00000000-0000-4000-8000-000000000030/save-as-recipe", payload: { name: "Steal" } },
    ]) {
      expect((await app.inject({ ...request, headers: { cookie: "session=owner-b" } })).statusCode, request.url).toBe(404);
    }
    expect(audit.events.map((event) => event.action)).toEqual(["recipe.created", "recipe.profiles_replaced", "recipe.decision_changed", "recipe.decision_removed", "recipe.archived", "recipe.restored", "recipe.created"]);
    expect(audit.events.every((event) => event.entityType === "recipe")).toBe(true);
  });

  it("reads settings, updates onboarding and installs or removes samples on request only", async () => {
    const { app, samples, workspace, audit } = await createApp();
    expect((await app.inject("/v1/workspace/settings")).statusCode).toBe(401);
    const read = await app.inject({ url: "/v1/workspace/settings", headers });
    expect(workspaceSettingsResponseSchema.parse(read.json()).settings).toMatchObject({ onboardingState: "new", currentSampleVersion: "1" });
    expect(samples.install).not.toHaveBeenCalled();

    const skipped = await app.inject({ method: "PATCH", url: "/v1/workspace/onboarding", headers, payload: { state: "skipped", choice: "empty" } });
    expect(skipped.statusCode).toBe(200);
    expect(workspace.updateOnboarding).toHaveBeenCalledWith(ownerA, "skipped", "empty");
    expect((await app.inject({ method: "PATCH", url: "/v1/workspace/onboarding", headers, payload: { state: "done" } })).statusCode).toBe(400);

    const installed = await app.inject({ method: "POST", url: "/v1/workspace/samples", headers });
    expect(installed.statusCode).toBe(201);
    expect(sampleInstallResponseSchema.parse(installed.json())).toMatchObject({ created: true, counts: { resources: 8 } });
    expect((await app.inject({ method: "POST", url: "/v1/workspace/samples", headers })).statusCode).toBe(200);
    expect(samples.install).toHaveBeenCalledWith(ownerA);
    const removed = await app.inject({ method: "DELETE", url: "/v1/workspace/samples", headers });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().removed.resources).toBe(8);
    expect(audit.events.map((event) => [event.action, event.entityType])).toEqual([
      ["workspace.onboarding_updated", "workspace"],
      ["workspace.samples_installed", "workspace"],
      ["workspace.samples_removed", "workspace"],
    ]);
  });
});
