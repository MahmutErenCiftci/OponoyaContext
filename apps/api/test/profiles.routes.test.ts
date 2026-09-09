import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Profile } from "@devcontext/contracts";
import { apiErrorSchema, profileListResponseSchema, profileResponseSchema } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { resourceUnavailableError } from "../src/modules/decisions/service.js";
import type { ProfileService } from "../src/modules/profiles/service.js";
import { memoryAudit } from "./support/memory-audit.js";
import { unlimitedEntitlements } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const nextJs = "00000000-0000-4000-8000-000000000010";
const foreign = "00000000-0000-4000-8000-000000000020";
const now = new Date().toISOString();
const profile: Profile = {
  id: "00000000-0000-4000-8000-000000000070", name: "Fast SaaS", slug: "fast-saas-00000000", type: "stack", description: null,
  decisionCount: 1, projectCount: 0, archivedAt: null, createdAt: now, updatedAt: now,
  decisions: [{ id: "00000000-0000-4000-8000-000000000080", scope: "profile", origin: { id: "00000000-0000-4000-8000-000000000070", name: "Fast SaaS", priority: 0 }, slot: "frontend.framework", mode: "LOCKED", resource: { id: nextJs, name: "Next.js", slug: "next-js", type: "framework", sourceUrl: null, archivedAt: null }, priority: 0, constraints: {}, rationale: null, conditions: {}, updatedAt: now }],
};

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
  return Object.assign(new Error("Profile not found"), { statusCode: 404 });
}

function service(): ProfileService {
  const guard = (ownerUserId: string) => { if (ownerUserId !== ownerA) throw notFound(); };
  return {
    list: vi.fn(async (ownerUserId) => ({ profiles: ownerUserId === ownerA ? [profile] : [], total: ownerUserId === ownerA ? 1 : 0 })),
    get: vi.fn(async (ownerUserId) => { guard(ownerUserId); return profile; }),
    create: vi.fn(async () => profile),
    update: vi.fn(async (ownerUserId) => { guard(ownerUserId); return profile; }),
    archive: vi.fn(async (ownerUserId) => { guard(ownerUserId); return { ...profile, archivedAt: now }; }),
    restore: vi.fn(async (ownerUserId) => { guard(ownerUserId); return profile; }),
    upsertDecision: vi.fn(async (ownerUserId, _profileId, _slot, input) => {
      guard(ownerUserId);
      if (input.resourceId === foreign) throw resourceUnavailableError();
      return profile.decisions[0]!;
    }),
    removeDecision: vi.fn(async (ownerUserId) => { guard(ownerUserId); }),
    saveFromProject: vi.fn(async (ownerUserId, _projectId, _input, idempotencyKey) => { guard(ownerUserId); return { profile, created: idempotencyKey !== "00000000-0000-4000-8000-000000000098" }; }),
  };
}

async function createApp(profiles = service()) {
  const app = await buildApp(
    readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }),
    { auth: auth(), profiles, audit: memoryAudit(), entitlements: unlimitedEntitlements() },
  );
  apps.push(app);
  return { app, profiles };
}

describe("Profile routes", () => {
  it("requires authentication and hides foreign Profiles", async () => {
    const { app, profiles } = await createApp();
    expect((await app.inject("/v1/profiles")).statusCode).toBe(401);
    const owned = await app.inject({ url: "/v1/profiles?type=stack&limit=5", headers: { cookie: "session=owner-a" } });
    expect(profileListResponseSchema.parse(owned.json()).total).toBe(1);
    expect(profiles.list).toHaveBeenCalledWith(ownerA, expect.objectContaining({ type: "stack", limit: 5, archived: "active" }));
    const headers = { cookie: "session=owner-b" };
    expect((await app.inject({ url: `/v1/profiles/${profile.id}`, headers })).statusCode).toBe(404);
    expect((await app.inject({ method: "PATCH", url: `/v1/profiles/${profile.id}`, headers, payload: { name: "Hijack" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/v1/profiles/${profile.id}/decisions/frontend.framework`, headers, payload: { mode: "LOCKED", resourceId: nextJs } })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/v1/profiles/${profile.id}/decisions/frontend.framework`, headers })).statusCode).toBe(404);
  });

  it("validates payloads and supports create, edit, archive, restore and decisions", async () => {
    const { app, profiles } = await createApp();
    const headers = { cookie: "session=owner-a" };
    expect((await app.inject({ method: "POST", url: "/v1/profiles", headers, payload: { name: "", type: "stack" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/profiles", headers, payload: { name: "Fast SaaS", type: "team" } })).statusCode).toBe(400);
    const created = await app.inject({ method: "POST", url: "/v1/profiles", headers, payload: { name: "Fast SaaS", type: "stack" } });
    expect(created.statusCode).toBe(201);
    expect(profileResponseSchema.parse(created.json()).profile.name).toBe("Fast SaaS");
    expect((await app.inject({ method: "PATCH", url: `/v1/profiles/${profile.id}`, headers, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/v1/profiles/${profile.id}`, headers, payload: { description: "Boring stack" } })).statusCode).toBe(200);
    expect(profileResponseSchema.parse((await app.inject({ method: "DELETE", url: `/v1/profiles/${profile.id}`, headers })).json()).profile.archivedAt).toBe(now);
    expect((await app.inject({ method: "POST", url: `/v1/profiles/${profile.id}/restore`, headers })).statusCode).toBe(200);

    const rejected = await app.inject({ method: "PUT", url: `/v1/profiles/${profile.id}/decisions/frontend.framework`, headers, payload: { mode: "LOCKED", resourceId: foreign } });
    expect(rejected.statusCode).toBe(400);
    expect(apiErrorSchema.parse(rejected.json()).error.details).toEqual([{ path: ["resourceId"], code: "resource_unavailable" }]);
    expect((await app.inject({ method: "PUT", url: `/v1/profiles/${profile.id}/decisions/Framework`, headers, payload: { mode: "LOCKED", resourceId: nextJs } })).statusCode).toBe(400);
    const saved = await app.inject({ method: "PUT", url: `/v1/profiles/${profile.id}/decisions/frontend.framework`, headers, payload: { mode: "LOCKED", resourceId: nextJs } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().decision.origin.name).toBe("Fast SaaS");
    expect(profiles.upsertDecision).toHaveBeenCalledWith(ownerA, profile.id, "frontend.framework", expect.objectContaining({ mode: "LOCKED", resourceId: nextJs }));
    const removed = await app.inject({ method: "DELETE", url: `/v1/profiles/${profile.id}/decisions/frontend.framework`, headers });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ decision: null });

    const projectId = "00000000-0000-4000-8000-000000000030";
    const savedProfile = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/save-as-profile`, headers, payload: { name: "Finance stack", type: "stack" } });
    expect(savedProfile.statusCode).toBe(201);
    expect(profiles.saveFromProject).toHaveBeenCalledWith(ownerA, projectId, { name: "Finance stack", type: "stack" }, undefined);
    const replay = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/save-as-profile`, headers: { ...headers, "idempotency-key": "00000000-0000-4000-8000-000000000098" }, payload: { name: "Finance stack", type: "stack" } });
    expect(replay.statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/projects/${projectId}/save-as-profile`, headers, payload: { name: "", type: "stack" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: `/v1/projects/${projectId}/save-as-profile`, headers: { cookie: "session=owner-b" }, payload: { name: "Steal", type: "stack" } })).statusCode).toBe(404);
  });
});
