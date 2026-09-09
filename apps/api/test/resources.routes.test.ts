import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Resource } from "@devcontext/contracts";
import { apiErrorSchema, resourceMutationResponseSchema } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import type { ResourceService } from "../src/modules/resources/service.js";
import { memoryAudit } from "./support/memory-audit.js";
import { unlimitedEntitlements } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const now = new Date().toISOString();
const resource: Resource = {
  id: "00000000-0000-4000-8000-000000000010", name: "Next.js", slug: "next-js-00000000",
  type: "framework", description: null, sourceUrl: "https://nextjs.org", docsUrl: null,
  repoUrl: null, installCommand: null, notes: null, metadata: {}, tags: ["frontend"],
  preference: { id: "00000000-0000-4000-8000-000000000011", slot: "frontend.framework", mode: "PREFERRED" },
  favorite: false, archivedAt: null, createdAt: now, updatedAt: now,
};

function auth(): AuthProvider {
  return {
    async handler() { return new Response(); },
    async getSession(headers) {
      const match = /session=(owner-a|owner-b)/.exec(headers.get("cookie") ?? "");
      if (!match?.[1]) return null;
      return { user: { id: match[1] === "owner-a" ? "00000000-0000-4000-8000-000000000001" : "00000000-0000-4000-8000-000000000002", email: `${match[1]}@example.test`, name: match[1], image: null } };
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
  };
}

function service(): ResourceService {
  return {
    list: vi.fn(async (ownerUserId) => ({ resources: ownerUserId.endsWith("1") ? [resource] : [], total: ownerUserId.endsWith("1") ? 1 : 0 })),
    get: vi.fn(async (ownerUserId) => {
      if (!ownerUserId.endsWith("1")) throw Object.assign(new Error("Not found"), { statusCode: 404 });
      return resource;
    }),
    create: vi.fn(async () => ({ resource, warnings: [], duplicates: [] })),
    update: vi.fn(async () => ({ resource: { ...resource, favorite: true }, warnings: [], duplicates: [] })),
    archive: vi.fn(async () => ({ resource: { ...resource, archivedAt: now, preference: null }, warnings: [], duplicates: [] })),
    restore: vi.fn(async () => ({ resource, warnings: [], duplicates: [] })),
    listCatalogLinks: vi.fn(async () => []),
  };
}

async function createApp(resources = service()) {
  const app = await buildApp(readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }), { auth: auth(), resources, audit: memoryAudit(), entitlements: unlimitedEntitlements() });
  apps.push(app);
  return { app, resources };
}

describe("Resource Library routes", () => {
  it("requires authentication and scopes reads to the session owner", async () => {
    const { app, resources } = await createApp();
    const anonymous = await app.inject("/v1/resources");
    expect(anonymous.statusCode).toBe(401);
    const owned = await app.inject({ url: "/v1/resources?type=framework&limit=10", headers: { cookie: "session=owner-a", "x-owner-user-id": "spoofed" } });
    expect(owned.json().total).toBe(1);
    expect(resources.list).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", expect.objectContaining({ type: "framework", limit: 10 }));
    const isolated = await app.inject({ url: `/v1/resources/${resource.id}`, headers: { cookie: "session=owner-b" } });
    expect(isolated.statusCode).toBe(404);
  });

  it("validates URLs and supports create, edit, archive and restore", async () => {
    const { app, resources } = await createApp();
    const headers = { cookie: "session=owner-a" };
    const invalid = await app.inject({ method: "POST", url: "/v1/resources", headers, payload: { name: "Private", type: "reference", sourceUrl: "file:///secret" } });
    expect(invalid.statusCode).toBe(400);
    expect(apiErrorSchema.parse(invalid.json()).error.code).toBe("VALIDATION_ERROR");
    const created = await app.inject({ method: "POST", url: "/v1/resources", headers, payload: { name: "Next.js", type: "framework", preference: { slot: "frontend.framework", mode: "PREFERRED" } } });
    expect(created.statusCode).toBe(201);
    expect(resourceMutationResponseSchema.parse(created.json()).resource.name).toBe("Next.js");
    await app.inject({ method: "PATCH", url: `/v1/resources/${resource.id}`, headers, payload: { tags: ["web"] } });
    const starred = await app.inject({ method: "PATCH", url: `/v1/resources/${resource.id}`, headers, payload: { favorite: true } });
    expect(resourceMutationResponseSchema.parse(starred.json()).resource.favorite).toBe(true);
    expect(resources.update).toHaveBeenLastCalledWith("00000000-0000-4000-8000-000000000001", resource.id, { favorite: true });
    const favorites = await app.inject({ url: "/v1/resources?favorite=true", headers });
    expect(favorites.statusCode).toBe(200);
    expect(resources.list).toHaveBeenLastCalledWith("00000000-0000-4000-8000-000000000001", expect.objectContaining({ favorite: "true" }));
    await app.inject({ method: "DELETE", url: `/v1/resources/${resource.id}`, headers });
    await app.inject({ method: "POST", url: `/v1/resources/${resource.id}/restore`, headers });
    expect(resources.update).toHaveBeenCalledTimes(2);
    expect(resources.archive).toHaveBeenCalledOnce();
    expect(resources.restore).toHaveBeenCalledOnce();
  });
});
