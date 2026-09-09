import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { CompatibilityRule, SearchResult } from "@devcontext/contracts";
import { apiErrorSchema, compatibilityRuleResponseSchema, searchResponseSchema, workspaceSummarySchema } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { ruleResourceUnavailableError, type CompatibilityService } from "../src/modules/compatibility/service.js";
import type { SearchService } from "../src/modules/search/service.js";
import { memoryAudit } from "./support/memory-audit.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const nextJs = "00000000-0000-4000-8000-000000000010";
const postgres = "00000000-0000-4000-8000-000000000011";
const foreign = "00000000-0000-4000-8000-000000000020";
const now = new Date().toISOString();
const rule: CompatibilityRule = {
  id: "00000000-0000-4000-8000-000000000090", kind: "requires", note: null, createdAt: now,
  left: { id: nextJs, name: "Next.js", slug: "next-js", type: "framework", sourceUrl: null, archivedAt: null },
  right: { id: postgres, name: "PostgreSQL", slug: "postgresql", type: "database", sourceUrl: null, archivedAt: null },
};
const result: SearchResult = { kind: "resource", id: nextJs, name: "Next.js", subtitle: "framework", archived: false, updatedAt: now };

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

function compatibility(): CompatibilityService {
  return {
    list: vi.fn(async (ownerUserId) => ownerUserId === ownerA ? [rule] : []),
    create: vi.fn(async (_ownerUserId, input) => {
      if (input.leftResourceId === foreign) throw ruleResourceUnavailableError("leftResourceId");
      return { rule, created: input.kind === "requires" };
    }),
    remove: vi.fn(async (ownerUserId) => { if (ownerUserId !== ownerA) throw Object.assign(new Error("Rule not found"), { statusCode: 404 }); }),
  };
}

function search(): SearchService {
  return { search: vi.fn(async (ownerUserId, query) => ({ query, results: ownerUserId === ownerA ? [result] : [] })) };
}

async function createApp() {
  const dependencies = { auth: auth(), compatibility: compatibility(), search: search(), audit: memoryAudit() };
  const app = await buildApp(readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }), dependencies);
  apps.push(app);
  return { app, ...dependencies };
}

describe("V0.3 usability routes", () => {
  it("scopes search to the session owner and validates the query", async () => {
    const { app, search } = await createApp();
    expect((await app.inject("/v1/search?q=next")).statusCode).toBe(401);
    expect((await app.inject({ url: "/v1/search", headers: { cookie: "session=owner-a" } })).statusCode).toBe(400);
    const owned = await app.inject({ url: "/v1/search?q=%20next%20&limit=5", headers: { cookie: "session=owner-a" } });
    expect(searchResponseSchema.parse(owned.json()).results).toHaveLength(1);
    expect(search.search).toHaveBeenCalledWith(ownerA, "next", 5);
    expect(searchResponseSchema.parse((await app.inject({ url: "/v1/search?q=next", headers: { cookie: "session=owner-b" } })).json()).results).toEqual([]);
  });

  it("creates, lists and removes compatibility rules with owner scoping and per-side errors", async () => {
    const { app, compatibility } = await createApp();
    const headers = { cookie: "session=owner-a" };
    expect((await app.inject({ method: "POST", url: "/v1/compatibility-rules", headers, payload: { kind: "requires", leftResourceId: nextJs, rightResourceId: nextJs } })).statusCode).toBe(400);
    const created = await app.inject({ method: "POST", url: "/v1/compatibility-rules", headers, payload: { kind: "requires", leftResourceId: nextJs, rightResourceId: postgres } });
    expect(created.statusCode).toBe(201);
    expect(compatibilityRuleResponseSchema.parse(created.json()).rule.left.name).toBe("Next.js");
    const replay = await app.inject({ method: "POST", url: "/v1/compatibility-rules", headers, payload: { kind: "conflicts", leftResourceId: nextJs, rightResourceId: postgres } });
    expect(replay.statusCode).toBe(200);
    const rejected = await app.inject({ method: "POST", url: "/v1/compatibility-rules", headers, payload: { kind: "requires", leftResourceId: foreign, rightResourceId: postgres } });
    expect(rejected.statusCode).toBe(400);
    expect(apiErrorSchema.parse(rejected.json()).error.details).toEqual([{ path: ["leftResourceId"], code: "resource_unavailable" }]);
    expect(rejected.body).not.toContain(foreign);
    const listed = await app.inject({ url: `/v1/compatibility-rules?resourceId=${nextJs}`, headers });
    expect(listed.json().rules).toHaveLength(1);
    expect(compatibility.list).toHaveBeenCalledWith(ownerA, nextJs, 100);
    expect((await app.inject({ method: "DELETE", url: `/v1/compatibility-rules/${rule.id}`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: `/v1/compatibility-rules/${rule.id}`, headers: { cookie: "session=owner-b" } })).statusCode).toBe(404);
  });

  it("requires authentication for the workspace summary", async () => {
    const { app } = await createApp();
    expect((await app.inject("/v1/workspace/summary")).statusCode).toBe(401);
    expect(workspaceSummarySchema.safeParse({ resources: 0, favorites: 0, projects: 0, profiles: 0, compiledProjects: 0, contextVersions: 0, exports: 0 }).success).toBe(true);
  });
});
