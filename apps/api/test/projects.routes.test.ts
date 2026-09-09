import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Project } from "@devcontext/contracts";
import { apiErrorSchema, projectListResponseSchema, projectResponseSchema } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { unavailableResourcesError, type ProjectService } from "../src/modules/projects/service.js";
import { memoryAudit } from "./support/memory-audit.js";
import { unlimitedEntitlements } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const foreignResource = "00000000-0000-4000-8000-000000000020";
const now = new Date().toISOString();
const project: Project = {
  id: "00000000-0000-4000-8000-000000000030", name: "Atlas Finance", slug: "atlas-finance-00000000",
  description: "Personal finance SaaS", productType: "SaaS", stage: "mvp", status: "active",
  platforms: ["web"], priorities: ["Fast MVP"], rules: [], recipe: null, profiles: [],
  resources: [{ id: "00000000-0000-4000-8000-000000000010", name: "Next.js", slug: "next-js-00000000", type: "framework", sourceUrl: "https://nextjs.org", archivedAt: null, attachedAt: now }],
  createdAt: now, updatedAt: now,
};

function auth(): AuthProvider {
  return {
    async handler() { return new Response(); },
    async getSession(headers) {
      const match = /session=(owner-a|owner-b)/.exec(headers.get("cookie") ?? "");
      if (!match?.[1]) return null;
      const id = match[1] === "owner-a" ? ownerA : ownerB;
      return { user: { id, email: `${match[1]}@example.test`, name: match[1], image: null } };
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
  };
}

function service(): ProjectService {
  const seenKeys = new Set<string>();
  return {
    list: vi.fn(async (ownerUserId) => ({ projects: ownerUserId === ownerA ? [project] : [], total: ownerUserId === ownerA ? 1 : 0 })),
    get: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw Object.assign(new Error("Not found"), { statusCode: 404 });
      return project;
    }),
    create: vi.fn(async (_ownerUserId, input, idempotencyKey) => {
      if (input.resourceIds?.includes(foreignResource)) throw unavailableResourcesError([input.resourceIds.indexOf(foreignResource)]);
      const key = idempotencyKey ?? input.clientRequestId ?? crypto.randomUUID();
      const created = !seenKeys.has(key);
      seenKeys.add(key);
      return { project, created };
    }),
    update: vi.fn(async () => project),
    archive: vi.fn(async () => ({ ...project, status: "archived" as const })),
    restore: vi.fn(async () => project),
    clone: vi.fn(async (ownerUserId, _projectId, input, idempotencyKey) => {
      if (ownerUserId !== ownerA) throw Object.assign(new Error("Not found"), { statusCode: 404 });
      return { project: { ...project, name: input.name ?? `Copy of ${project.name}` }, created: idempotencyKey !== "00000000-0000-4000-8000-000000000097" };
    }),
  };
}

async function createApp(projects = service()) {
  const app = await buildApp(
    readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }),
    { auth: auth(), projects, audit: memoryAudit(), entitlements: unlimitedEntitlements() },
  );
  apps.push(app);
  return { app, projects };
}

describe("Project routes", () => {
  it("requires authentication and scopes every read to the session owner", async () => {
    const { app, projects } = await createApp();
    expect((await app.inject("/v1/projects")).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/projects", payload: { name: "Anonymous" } })).statusCode).toBe(401);
    const owned = await app.inject({ url: "/v1/projects?status=all&stage=mvp&limit=10", headers: { cookie: "session=owner-a", "x-owner-user-id": ownerB } });
    expect(projectListResponseSchema.parse(owned.json()).total).toBe(1);
    expect(projects.list).toHaveBeenCalledWith(ownerA, expect.objectContaining({ status: "all", stage: "mvp", limit: 10 }));
    const foreign = await app.inject({ url: `/v1/projects/${project.id}`, headers: { cookie: "session=owner-b" } });
    expect(foreign.statusCode).toBe(404);
    expect(projects.get).toHaveBeenCalledWith(ownerB, project.id);
    expect((await app.inject({ url: "/v1/projects/not-a-uuid", headers: { cookie: "session=owner-a" } })).statusCode).toBe(400);
  });

  it("validates wizard payloads, the Idempotency-Key header and replayed creates", async () => {
    const { app, projects } = await createApp();
    const headers = { cookie: "session=owner-a" };
    const invalid = await app.inject({ method: "POST", url: "/v1/projects", headers, payload: { name: "", resourceIds: ["nope"] } });
    expect(invalid.statusCode).toBe(400);
    const issue = apiErrorSchema.parse(invalid.json());
    expect(issue.error.code).toBe("VALIDATION_ERROR");
    expect(issue.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["name"] }), expect.objectContaining({ path: ["resourceIds", "0"] })]));
    expect(invalid.body).not.toContain("nope");

    const badKey = await app.inject({ method: "POST", url: "/v1/projects", headers: { ...headers, "idempotency-key": "retry-1" }, payload: { name: "Atlas" } });
    expect(badKey.statusCode).toBe(400);
    expect(projects.create).not.toHaveBeenCalled();

    const key = "00000000-0000-4000-8000-000000000099";
    const first = await app.inject({ method: "POST", url: "/v1/projects", headers: { ...headers, "idempotency-key": key }, payload: { name: "Atlas Finance", resourceIds: [project.resources[0]!.id] } });
    expect(first.statusCode).toBe(201);
    expect(projectResponseSchema.parse(first.json()).project.name).toBe("Atlas Finance");
    expect(projects.create).toHaveBeenLastCalledWith(ownerA, expect.objectContaining({ name: "Atlas Finance", stage: "mvp", platforms: ["web"], rules: [] }), key);
    const replay = await app.inject({ method: "POST", url: "/v1/projects", headers: { ...headers, "idempotency-key": key }, payload: { name: "Atlas Finance" } });
    expect(replay.statusCode).toBe(200);
    expect(projectResponseSchema.parse(replay.json()).project.id).toBe(project.id);
  });

  it("reports unavailable Resource positions without revealing their IDs", async () => {
    const { app } = await createApp();
    const response = await app.inject({
      method: "POST", url: "/v1/projects", headers: { cookie: "session=owner-a" },
      payload: { name: "Leak attempt", resourceIds: [project.resources[0]!.id, foreignResource] },
    });
    expect(response.statusCode).toBe(400);
    const parsed = apiErrorSchema.parse(response.json());
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
    expect(parsed.error.details).toEqual([{ path: ["resourceIds", "1"], code: "resource_unavailable" }]);
    expect(response.body).not.toContain(foreignResource);
  });

  it("supports edit, archive and restore through thin handlers", async () => {
    const { app, projects } = await createApp();
    const headers = { cookie: "session=owner-a" };
    expect((await app.inject({ method: "PATCH", url: `/v1/projects/${project.id}`, headers, payload: {} })).statusCode).toBe(400);
    const edited = await app.inject({ method: "PATCH", url: `/v1/projects/${project.id}`, headers, payload: { description: null, resourceIds: [] } });
    expect(edited.statusCode).toBe(200);
    expect(projects.update).toHaveBeenCalledWith(ownerA, project.id, { description: null, resourceIds: [] });
    const attached = await app.inject({ method: "PUT", url: `/v1/projects/${project.id}/profiles`, headers, payload: { profiles: [{ profileId: "00000000-0000-4000-8000-000000000070", priority: 2 }] } });
    expect(attached.statusCode).toBe(200);
    expect(projects.update).toHaveBeenLastCalledWith(ownerA, project.id, { profiles: [{ profileId: "00000000-0000-4000-8000-000000000070", priority: 2 }] });
    expect((await app.inject({ method: "PUT", url: `/v1/projects/${project.id}/profiles`, headers, payload: { profiles: [{ profileId: "nope" }] } })).statusCode).toBe(400);
    const archived = await app.inject({ method: "DELETE", url: `/v1/projects/${project.id}`, headers });
    expect(projectResponseSchema.parse(archived.json()).project.status).toBe("archived");
    const restored = await app.inject({ method: "POST", url: `/v1/projects/${project.id}/restore`, headers });
    expect(projectResponseSchema.parse(restored.json()).project.status).toBe("active");
    expect(projects.archive).toHaveBeenCalledWith(ownerA, project.id);
    expect(projects.restore).toHaveBeenCalledWith(ownerA, project.id);

    const cloned = await app.inject({ method: "POST", url: `/v1/projects/${project.id}/clone`, headers });
    expect(cloned.statusCode).toBe(201);
    expect(cloned.json().project.name).toBe("Copy of Atlas Finance");
    expect(projects.clone).toHaveBeenCalledWith(ownerA, project.id, {}, undefined);
    const replay = await app.inject({ method: "POST", url: `/v1/projects/${project.id}/clone`, headers: { ...headers, "idempotency-key": "00000000-0000-4000-8000-000000000097" }, payload: { name: "Beacon" } });
    expect(replay.statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/projects/${project.id}/clone`, headers, payload: { name: "" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: `/v1/projects/${project.id}/clone`, headers: { cookie: "session=owner-b" } })).statusCode).toBe(404);
  });
});
