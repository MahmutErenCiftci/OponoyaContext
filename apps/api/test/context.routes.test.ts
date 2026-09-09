import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { ContextVersion } from "@devcontext/contracts";
import {
  apiErrorSchema,
  compileResponseSchema,
  contextStateResponseSchema,
  contextVersionListResponseSchema,
  exportListResponseSchema,
  exportResponseSchema,
} from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { notCompiledError, type ContextService } from "../src/modules/context/service.js";
import { memoryAudit } from "./support/memory-audit.js";
import { unlimitedEntitlements } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000030";
const now = new Date().toISOString();
const version: ContextVersion = {
  id: "00000000-0000-4000-8000-000000000050", version: 1, compilerVersion: "0.2.0", contentHash: "a".repeat(64),
  decisionCount: 0, warningCount: 0, createdAt: now,
  canonical: { compilerVersion: "0.2.0", project: { id: projectId, name: "Atlas", slug: null, description: null, productType: null, stage: "mvp", platforms: [], priorities: [] }, decisions: [], resources: [], rules: [], warnings: [] },
  previews: [{ target: "agents", fileName: "AGENTS.md", content: "# AGENTS.md — Atlas" }],
};
const event = { id: "00000000-0000-4000-8000-000000000060", target: "agents" as const, fileName: "AGENTS.md", contextVersion: 1, contentHash: version.contentHash, createdAt: now };

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

function service(): ContextService {
  let compiled = false;
  return {
    compile: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw notFound();
      const created = !compiled;
      compiled = true;
      return { version, created };
    }),
    current: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw notFound();
      return { version: compiled ? version : null, stale: !compiled, draftHash: version.contentHash, draftWarnings: [] };
    }),
    listVersions: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw notFound();
      return compiled ? [{ id: version.id, version: 1, compilerVersion: "0.2.0", contentHash: version.contentHash, decisionCount: 0, warningCount: 0, createdAt: now }] : [];
    }),
    getVersion: vi.fn(async (ownerUserId, _projectId, number) => {
      if (ownerUserId !== ownerA || number !== 1) throw notFound();
      return version;
    }),
    export: vi.fn(async (ownerUserId, _projectId, input, idempotencyKey) => {
      if (ownerUserId !== ownerA) throw notFound();
      if (!compiled) throw notCompiledError();
      return { export: { ...version.previews[0]!, target: input.target, contextVersion: 1, contentHash: version.contentHash }, event, created: idempotencyKey !== "00000000-0000-4000-8000-000000000098" };
    }),
    listExports: vi.fn(async (ownerUserId) => {
      if (ownerUserId !== ownerA) throw notFound();
      return [event];
    }),
    bundle: vi.fn(async (ownerUserId, _projectId, versionNumber, idempotencyKey) => {
      if (ownerUserId !== ownerA) throw notFound();
      if (!compiled) throw notCompiledError();
      if (versionNumber !== undefined && versionNumber !== 1) throw notFound();
      return { fileName: "atlas-context-v1.zip", content: Buffer.from("PK-test"), contextVersion: 1, contentHash: version.contentHash, event: { ...event, target: "bundle" as const, fileName: "atlas-context-v1.zip" }, created: idempotencyKey !== "00000000-0000-4000-8000-000000000098" };
    }),
    diff: vi.fn(async (ownerUserId, _projectId, range) => {
      if (ownerUserId !== ownerA) throw notFound();
      if (range.to !== undefined && range.to > 1) throw notFound();
      return { from: null, to: null, diff: null };
    }),
  };
}

async function createApp(context = service()) {
  const app = await buildApp(
    readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" }),
    { auth: auth(), context, audit: memoryAudit(), entitlements: unlimitedEntitlements() },
  );
  apps.push(app);
  return { app, context };
}

describe("Context routes", () => {
  it("requires authentication and hides foreign Projects on every route", async () => {
    const { app } = await createApp();
    expect((await app.inject({ method: "POST", url: `/v1/projects/${projectId}/compile` })).statusCode).toBe(401);
    const headers = { cookie: "session=owner-b" };
    for (const request of [
      { method: "POST" as const, url: `/v1/projects/${projectId}/compile` },
      { method: "GET" as const, url: `/v1/projects/${projectId}/context` },
      { method: "GET" as const, url: `/v1/projects/${projectId}/context/versions` },
      { method: "GET" as const, url: `/v1/projects/${projectId}/context/versions/1` },
      { method: "POST" as const, url: `/v1/projects/${projectId}/exports`, payload: { target: "agents" } },
      { method: "GET" as const, url: `/v1/projects/${projectId}/exports` },
      { method: "GET" as const, url: `/v1/projects/${projectId}/context/diff` },
      { method: "GET" as const, url: `/v1/projects/${projectId}/context/bundle` },
    ]) {
      const response = await app.inject({ ...request, headers });
      expect(response.statusCode, request.url).toBe(404);
    }
  });

  it("compiles with 201 then 200, exposes state and history, and validates version parameters", async () => {
    const { app, context } = await createApp();
    const headers = { cookie: "session=owner-a" };
    const empty = await app.inject({ url: `/v1/projects/${projectId}/context`, headers });
    expect(contextStateResponseSchema.parse(empty.json())).toMatchObject({ version: null, stale: true });
    const first = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/compile`, headers });
    expect(first.statusCode).toBe(201);
    expect(compileResponseSchema.parse(first.json()).version.version).toBe(1);
    const second = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/compile`, headers });
    expect(second.statusCode).toBe(200);
    expect(context.compile).toHaveBeenCalledWith(ownerA, projectId);
    const versions = await app.inject({ url: `/v1/projects/${projectId}/context/versions`, headers });
    expect(contextVersionListResponseSchema.parse(versions.json()).versions).toHaveLength(1);
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/versions/1`, headers })).statusCode).toBe(200);
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/versions/0`, headers })).statusCode).toBe(400);
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/versions/latest`, headers })).statusCode).toBe(400);
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/versions/2`, headers })).statusCode).toBe(404);
    const diff = await app.inject({ url: `/v1/projects/${projectId}/context/diff?from=1`, headers });
    expect(diff.statusCode).toBe(200);
    expect(diff.json()).toEqual({ from: null, to: null, diff: null });
    expect(context.diff).toHaveBeenCalledWith(ownerA, projectId, { from: 1 });
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/diff?to=abc`, headers })).statusCode).toBe(400);
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/diff?to=7`, headers })).statusCode).toBe(404);
  });

  it("validates export requests, reports uncompiled Projects and records idempotent exports", async () => {
    const { app, context } = await createApp();
    const headers = { cookie: "session=owner-a" };
    const early = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/exports`, headers, payload: { target: "agents" } });
    expect(early.statusCode).toBe(409);
    expect(apiErrorSchema.parse(early.json()).error.details).toEqual([{ path: ["version"], code: "context_not_compiled" }]);
    await app.inject({ method: "POST", url: `/v1/projects/${projectId}/compile`, headers });

    const invalid = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/exports`, headers, payload: { target: "notion" } });
    expect(invalid.statusCode).toBe(400);
    const badKey = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/exports`, headers: { ...headers, "idempotency-key": "nope" }, payload: { target: "agents" } });
    expect(badKey.statusCode).toBe(400);

    const created = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/exports`, headers, payload: { target: "claude", version: 1 } });
    expect(created.statusCode).toBe(201);
    expect(exportResponseSchema.parse(created.json()).export.contextVersion).toBe(1);
    expect(context.export).toHaveBeenLastCalledWith(ownerA, projectId, { target: "claude", version: 1 }, undefined);
    const replay = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/exports`, headers: { ...headers, "idempotency-key": "00000000-0000-4000-8000-000000000098" }, payload: { target: "agents" } });
    expect(replay.statusCode).toBe(200);
    const history = await app.inject({ url: `/v1/projects/${projectId}/exports`, headers });
    expect(exportListResponseSchema.parse(history.json()).exports[0]?.fileName).toBe("AGENTS.md");

    const bundle = await app.inject({ url: `/v1/projects/${projectId}/context/bundle?version=1`, headers });
    expect(bundle.statusCode).toBe(200);
    expect(bundle.headers["content-type"]).toBe("application/zip");
    expect(bundle.headers["content-disposition"]).toBe('attachment; filename="atlas-context-v1.zip"');
    expect(bundle.rawPayload.toString()).toBe("PK-test");
    expect(context.bundle).toHaveBeenLastCalledWith(ownerA, projectId, 1, undefined);
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/bundle?version=9`, headers })).statusCode).toBe(404);
    expect((await app.inject({ url: `/v1/projects/${projectId}/context/bundle?version=zero`, headers })).statusCode).toBe(400);
  });
});
