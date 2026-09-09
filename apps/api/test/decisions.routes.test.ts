import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ProjectDecisionView } from "@devcontext/contracts";
import { apiErrorSchema, projectDecisionResponseSchema, projectDecisionsResponseSchema } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { resourceUnavailableError, type DecisionService } from "../src/modules/decisions/service.js";
import { memoryAudit } from "./support/memory-audit.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000030";
const nextJs = "00000000-0000-4000-8000-000000000010";
const foreign = "00000000-0000-4000-8000-000000000020";
const now = new Date().toISOString();
const view: ProjectDecisionView = {
  slot: "frontend.framework",
  source: "project",
  effective: { id: "00000000-0000-4000-8000-000000000040", scope: "project", origin: null, slot: "frontend.framework", mode: "LOCKED", resource: { id: nextJs, name: "Next.js", slug: "next-js", type: "framework", sourceUrl: null, archivedAt: null }, priority: 0, constraints: {}, rationale: null, conditions: {}, updatedAt: now },
  project: null,
  recipe: null,
  profile: null,
  profiles: [],
  global: null,
};
view.project = view.effective;

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
  return Object.assign(new Error("Project not found"), { statusCode: 404 });
}

function service(): DecisionService {
  return {
    list: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw notFound();
      return [view];
    }),
    upsert: vi.fn(async (ownerUserId, _projectId, _slot, input) => {
      if (ownerUserId !== ownerA) throw notFound();
      if (input.resourceId === foreign) throw resourceUnavailableError();
      return view;
    }),
    remove: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw notFound();
      return null;
    }),
    batch: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw notFound();
      return [view];
    }),
    listGlobal: vi.fn(async () => [{ ...view.effective, scope: "global" as const }]),
  };
}

async function createApp(decisions = service()) {
  const app = await buildApp(
    readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }),
    { auth: auth(), decisions, audit: memoryAudit() },
  );
  apps.push(app);
  return { app, decisions };
}

describe("Project decision routes", () => {
  it("requires authentication and hides foreign Projects on every nested route", async () => {
    const { app, decisions } = await createApp();
    expect((await app.inject(`/v1/projects/${projectId}/decisions`)).statusCode).toBe(401);
    const owned = await app.inject({ url: `/v1/projects/${projectId}/decisions`, headers: { cookie: "session=owner-a" } });
    expect(projectDecisionsResponseSchema.parse(owned.json()).decisions).toHaveLength(1);
    expect(decisions.list).toHaveBeenCalledWith(ownerA, projectId);
    const headers = { cookie: "session=owner-b" };
    expect((await app.inject({ url: `/v1/projects/${projectId}/decisions`, headers })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions/frontend.framework`, headers, payload: { mode: "LOCKED", resourceId: nextJs } })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/v1/projects/${projectId}/decisions/frontend.framework`, headers })).statusCode).toBe(404);
  });

  it("validates slots and payloads and forwards Resource detail codes without IDs", async () => {
    const { app, decisions } = await createApp();
    const headers = { cookie: "session=owner-a" };
    const badSlot = await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions/Framework`, headers, payload: { mode: "LOCKED", resourceId: nextJs } });
    expect(badSlot.statusCode).toBe(400);
    expect(apiErrorSchema.parse(badSlot.json()).error.details?.[0]?.path).toEqual(["slot"]);
    const badMode = await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions/frontend.framework`, headers, payload: { mode: "MAYBE" } });
    expect(badMode.statusCode).toBe(400);
    expect(decisions.upsert).not.toHaveBeenCalled();

    const rejected = await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions/frontend.framework`, headers, payload: { mode: "LOCKED", resourceId: foreign } });
    expect(rejected.statusCode).toBe(400);
    expect(apiErrorSchema.parse(rejected.json()).error.details).toEqual([{ path: ["resourceId"], code: "resource_unavailable" }]);
    expect(rejected.body).not.toContain(foreign);
  });

  it("upserts and removes Project overrides through thin handlers", async () => {
    const { app, decisions } = await createApp();
    const headers = { cookie: "session=owner-a" };
    const saved = await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions/frontend.framework`, headers, payload: { mode: "LOCKED", resourceId: nextJs, rationale: "Team standard" } });
    expect(saved.statusCode).toBe(200);
    expect(projectDecisionResponseSchema.parse(saved.json()).decision?.effective.mode).toBe("LOCKED");
    expect(decisions.upsert).toHaveBeenCalledWith(ownerA, projectId, "frontend.framework", expect.objectContaining({ mode: "LOCKED", resourceId: nextJs, priority: 0, constraints: {}, rationale: "Team standard", conditions: {} }));
    const removed = await app.inject({ method: "DELETE", url: `/v1/projects/${projectId}/decisions/frontend.framework`, headers });
    expect(removed.statusCode).toBe(200);
    expect(projectDecisionResponseSchema.parse(removed.json()).decision).toBeNull();
    expect(decisions.remove).toHaveBeenCalledWith(ownerA, projectId, "frontend.framework");

    const batched = await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions`, headers, payload: { decisions: [{ slot: "backend.framework", mode: "AI_DECIDE" }], removeSlots: ["frontend.ui.base"] } });
    expect(batched.statusCode).toBe(200);
    expect(projectDecisionsResponseSchema.parse(batched.json()).decisions).toHaveLength(1);
    expect(decisions.batch).toHaveBeenCalledWith(ownerA, projectId, expect.objectContaining({ removeSlots: ["frontend.ui.base"] }));
    expect((await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions`, headers, payload: { decisions: [], removeSlots: [] } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: `/v1/projects/${projectId}/decisions`, headers: { cookie: "session=owner-b" }, payload: { removeSlots: ["frontend.ui.base"] } })).statusCode).toBe(404);
    const global = await app.inject({ url: "/v1/global-decisions", headers });
    expect(global.statusCode).toBe(200);
    expect(global.json().decisions[0]?.scope).toBe("global");
    expect((await app.inject("/v1/global-decisions")).statusCode).toBe(401);
  });
});
