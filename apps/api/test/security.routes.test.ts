import { afterEach, describe, expect, it, vi } from "vitest";
import { Writable } from "node:stream";
import type { FastifyInstance } from "fastify";
import type { ContextVersion, Resource } from "@devcontext/contracts";
import { apiErrorSchema, auditEventListResponseSchema } from "@devcontext/contracts";
import { buildApp, requestBodyLimit, type AppDependencies } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { LogLevel } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import type { ContextService } from "../src/modules/context/service.js";
import type { ResourceService } from "../src/modules/resources/service.js";
import { memoryAudit } from "./support/memory-audit.js";
import { unlimitedEntitlements } from "./support/memory-billing.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000030";
const privateNotes = "private-notes-never-logged";
const now = new Date().toISOString();
const resource: Resource = {
  id: "00000000-0000-4000-8000-000000000010", name: "Next.js", slug: "next-js-00000000", type: "framework", description: null,
  sourceUrl: "https://nextjs.org", docsUrl: null, repoUrl: null, installCommand: null, notes: privateNotes, metadata: {}, tags: [],
  preference: { id: "00000000-0000-4000-8000-000000000011", slot: "frontend.framework", mode: "PREFERRED" }, favorite: false,
  archivedAt: null, createdAt: now, updatedAt: now,
};
const version: ContextVersion = {
  id: "00000000-0000-4000-8000-000000000050", version: 1, compilerVersion: "0.4.0", contentHash: "a".repeat(64), decisionCount: 0, warningCount: 0, createdAt: now,
  canonical: { compilerVersion: "0.4.0", project: { id: projectId, name: "Atlas", slug: null, description: null, productType: null, stage: "mvp", platforms: [], priorities: [] }, decisions: [], resources: [], rules: [], warnings: [] },
  previews: [{ target: "agents", fileName: "AGENTS.md", content: "# AGENTS.md" }],
};

function auth(): AuthProvider {
  return {
    async handler(request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/sign-up/email")) {
        return new Response(JSON.stringify({ token: "opaque-session-token-value", user: { id: ownerA, email: "owner-a@example.test" } }), {
          status: 200, headers: { "content-type": "application/json", "set-cookie": "devcontext.session_token=opaque-session-token-value; Path=/; HttpOnly" },
        });
      }
      if (url.pathname.endsWith("/sign-in/email")) return new Response(JSON.stringify({ message: "Invalid email or password" }), { status: 401 });
      return new Response(JSON.stringify({ session: null }), { status: 200, headers: { "content-type": "application/json" } });
    },
    async getSession(headers) {
      const match = /session=(owner-a|owner-b)/.exec(headers.get("cookie") ?? "");
      if (!match?.[1]) return null;
      return { user: { id: match[1] === "owner-a" ? ownerA : ownerB, email: `${match[1]}@example.test`, name: match[1], image: null } };
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
  };
}

function resources(): ResourceService {
  return {
    list: vi.fn(async () => ({ resources: [resource], total: 1 })),
    get: vi.fn(async () => resource),
    create: vi.fn(async (_owner, input) => ({ resource: { ...resource, notes: input.notes ?? null }, warnings: [], duplicates: [] })),
    update: vi.fn(async () => ({ resource, warnings: [], duplicates: [] })),
    archive: vi.fn(async () => ({ resource, warnings: [], duplicates: [] })),
    restore: vi.fn(async () => ({ resource, warnings: [], duplicates: [] })),
    listCatalogLinks: vi.fn(async () => []),
  };
}

function crashingResources(message: string): ResourceService {
  const service = resources();
  service.get = vi.fn(async () => { throw Object.assign(new Error(message), { code: "23505", constraint: "resources_owner_slug_unique" }); });
  return service;
}

function context(): ContextService {
  return {
    compile: vi.fn(async () => ({ version, created: true })),
    current: vi.fn(async () => ({ version, stale: false, draftHash: version.contentHash, draftWarnings: [] })),
    listVersions: vi.fn(async () => []),
    getVersion: vi.fn(async () => version),
    export: vi.fn(async () => ({ export: { ...version.previews[0]!, contextVersion: 1, contentHash: version.contentHash }, event: { id: "00000000-0000-4000-8000-000000000060", target: "agents" as const, fileName: "AGENTS.md", contextVersion: 1, contentHash: version.contentHash, createdAt: now }, created: true })),
    listExports: vi.fn(async () => []),
    bundle: vi.fn(async () => ({ fileName: "atlas-context-v1.zip", content: Buffer.from("PK"), contextVersion: 1, contentHash: version.contentHash, event: { id: "00000000-0000-4000-8000-000000000061", target: "bundle" as const, fileName: "atlas-context-v1.zip", contextVersion: 1, contentHash: version.contentHash, createdAt: now }, created: true })),
    diff: vi.fn(async () => ({ from: null, to: null, diff: null })),
  };
}

function logCapture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).split("\n").filter(Boolean)) lines.push(JSON.parse(line) as Record<string, unknown>);
      callback();
    },
  });
  return { lines, stream, text: () => lines.map((line) => JSON.stringify(line)).join("\n") };
}

async function createApp(overrides: Partial<AppDependencies> = {}, logLevel: LogLevel = "info") {
  const logs = logCapture();
  const audit = memoryAudit();
  const app = await buildApp(
    readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test", CORS_ORIGIN: "http://localhost:3000" }),
    { auth: auth(), resources: resources(), context: context(), audit, logStream: logs.stream, logLevel, entitlements: unlimitedEntitlements(), ...overrides },
  );
  apps.push(app);
  return { app, logs, audit };
}

const headersA = { cookie: "session=owner-a" };

describe("security hardening", () => {
  it("rejects browser mutations from a foreign origin and accepts the web origin or no origin", async () => {
    const { app, logs } = await createApp();
    const foreign = await app.inject({ method: "POST", url: "/v1/resources", headers: { ...headersA, origin: "https://evil.example" }, payload: { name: "X", type: "framework" } });
    expect(foreign.statusCode).toBe(403);
    expect(apiErrorSchema.parse(foreign.json()).error.code).toBe("FORBIDDEN");
    expect(logs.lines.find((line) => line.event === "origin_rejected")).toMatchObject({ category: "security", route: "/v1/resources", statusCode: 403 });
    const trusted = await app.inject({ method: "POST", url: "/v1/resources", headers: { ...headersA, origin: "http://localhost:3000" }, payload: { name: "X", type: "framework" } });
    expect(trusted.statusCode).toBe(201);
    const serverToServer = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload: { name: "X", type: "framework" } });
    expect(serverToServer.statusCode).toBe(201);
    const read = await app.inject({ url: "/v1/resources", headers: { ...headersA, origin: "https://evil.example" } });
    expect(read.statusCode).toBe(200);
  });

  it("applies bounded per-user limits for mutations, reads and expensive routes with standard headers", async () => {
    const { app, logs } = await createApp({ rateLimits: { mutate: { name: "mutate", max: 2, windowMs: 60_000 }, expensive: { name: "expensive", max: 1, windowMs: 60_000 }, read: { name: "read", max: 3, windowMs: 60_000 } } });
    const payload = { name: "Rate", type: "framework" };
    const first = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload });
    expect(first.statusCode).toBe(201);
    expect(first.headers["x-ratelimit-limit"]).toBe("2");
    expect(first.headers["x-ratelimit-remaining"]).toBe("1");
    expect((await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload })).statusCode).toBe(201);
    const blocked = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload });
    expect(blocked.statusCode).toBe(429);
    expect(apiErrorSchema.parse(blocked.json()).error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.headers["x-ratelimit-remaining"]).toBe("0");
    expect(logs.lines.find((line) => line.event === "rate_limited")).toMatchObject({ category: "security", rateLimitRule: "mutate", userId: ownerA });
    // Another user and other rules keep their own buckets.
    expect((await app.inject({ method: "POST", url: "/v1/resources", headers: { cookie: "session=owner-b" }, payload })).statusCode).toBe(201);
    expect((await app.inject({ url: "/v1/resources", headers: headersA })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/projects/${projectId}/compile`, headers: headersA })).statusCode).toBe(201);
    const expensive = await app.inject({ method: "POST", url: `/v1/projects/${projectId}/compile`, headers: headersA });
    expect(expensive.statusCode).toBe(429);
    expect(expensive.headers["x-ratelimit-limit"]).toBe("1");
    for (let attempt = 0; attempt < 2; attempt += 1) expect((await app.inject({ url: "/v1/resources", headers: headersA })).statusCode).toBe(200);
    expect((await app.inject({ url: "/v1/resources", headers: headersA })).statusCode).toBe(429);
    // Anonymous requests are refused before they can touch a bucket.
    expect((await app.inject({ method: "POST", url: "/v1/resources", payload })).statusCode).toBe(401);
  });

  it("limits anonymous auth traffic per client address without touching session reads", async () => {
    const { app } = await createApp({ rateLimits: { auth: { name: "auth", max: 2, windowMs: 60_000 } } });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email: "a@example.test", password: "wrong-password" } });
      expect(response.statusCode).toBe(401);
    }
    const blocked = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email: "a@example.test", password: "wrong-password" } });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect((await app.inject({ url: "/api/auth/get-session" })).statusCode).toBe(200);
    const other = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", remoteAddress: "10.1.1.1", payload: { email: "a@example.test", password: "wrong-password" } });
    expect(other.statusCode).toBe(401);
  });

  it("rejects oversized bodies and unsafe or oversized URLs before any service runs", async () => {
    const { app } = await createApp();
    const oversized = await app.inject({ method: "POST", url: "/v1/resources", headers: { ...headersA, "content-type": "application/json" }, payload: JSON.stringify({ name: "x".repeat(requestBodyLimit + 1024), type: "framework" }) });
    expect(oversized.statusCode).toBe(413);
    expect(apiErrorSchema.parse(oversized.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
    for (const sourceUrl of ["javascript:alert(1)", "file:///etc/passwd", "ftp://files.example.com/x", "data:text/html,hi", `https://example.com/${"a".repeat(2_100)}`]) {
      const response = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload: { name: "Bad", type: "framework", sourceUrl } });
      expect(response.statusCode, sourceUrl.slice(0, 20)).toBe(400);
      expect(apiErrorSchema.parse(response.json()).error.details?.some((detail) => detail.path[0] === "sourceUrl")).toBe(true);
      expect(response.body).not.toContain("alert(1)");
    }
    const patched = await app.inject({ method: "PATCH", url: `/v1/resources/${resource.id}`, headers: headersA, payload: { docsUrl: "javascript:void(0)" } });
    expect(patched.statusCode).toBe(400);
    const notes = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload: { name: "Long", type: "framework", notes: "n".repeat(10_001) } });
    expect(notes.statusCode).toBe(400);
    const metadata = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload: { name: "Meta", type: "framework", metadata: { blob: "m".repeat(20_001) } } });
    expect(metadata.statusCode).toBe(400);
  });

  it("exposes correlation and cache headers on every response", async () => {
    const { app } = await createApp();
    const response = await app.inject({ url: "/v1/resources/not-a-uuid", headers: headersA });
    expect(response.statusCode).toBe(400);
    expect(response.headers["x-request-id"]).toBe(apiErrorSchema.parse(response.json()).error.requestId);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    const health = await app.inject("/health");
    expect(health.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const spoofed = await app.inject({ url: "/health", headers: { "x-request-id": "attacker-chosen" } });
    expect(spoofed.headers["x-request-id"]).not.toBe("attacker-chosen");
  });

  it("writes structured request, security and error logs without secrets or private content", async () => {
    const { app, logs } = await createApp({ resources: crashingResources(`password=hunter2 postgresql://devcontext:hunter2@db.internal/devcontext ${privateNotes} cookie=devcontext.session_token=opaque`) });
    const listed = await app.inject({ url: "/v1/resources?q=secret-query-text", headers: { cookie: "session=owner-a; devcontext.session_token=opaque-session-token-value" } });
    expect(listed.statusCode).toBe(200);
    const anonymous = await app.inject({ url: "/v1/resources" });
    expect(anonymous.statusCode).toBe(401);
    const crashed = await app.inject({ url: `/v1/resources/${resource.id}`, headers: headersA });
    expect(crashed.statusCode).toBe(500);
    const requestId = apiErrorSchema.parse(crashed.json()).error.requestId;

    const http = logs.lines.find((line) => line.category === "http" && line.route === "/v1/resources" && line.statusCode === 200);
    expect(http).toMatchObject({ method: "GET", userId: ownerA });
    expect(typeof http?.durationMs).toBe("number");
    expect(logs.lines.find((line) => line.event === "auth_required")).toMatchObject({ category: "security", statusCode: 401, userId: null });
    const failure = logs.lines.find((line) => line.category === "unexpected_error");
    expect(failure).toMatchObject({ requestId, error: { name: "Error", code: "23505", constraint: "resources_owner_slug_unique" } });
    expect((failure?.error as { message?: string }).message).toBeUndefined();
    expect((failure?.error as { fingerprint: string }).fingerprint).toMatch(/^[a-f0-9]{12}$/);
    const text = logs.text();
    for (const secret of ["hunter2", "db.internal", privateNotes, "opaque-session-token-value", "secret-query-text", "owner-a@example.test"]) {
      expect(text).not.toContain(secret);
    }
    expect(crashed.body).not.toContain("hunter2");
  });

  it("includes only a redacted message at debug level", async () => {
    const { app, logs } = await createApp({ resources: crashingResources("password=hunter2 postgresql://devcontext:hunter2@db.internal/devcontext failed for owner@example.test") }, "debug");
    expect((await app.inject({ url: `/v1/resources/${resource.id}`, headers: headersA })).statusCode).toBe(500);
    const failure = logs.lines.find((line) => line.category === "unexpected_error") as { error: { message: string } } | undefined;
    expect(failure?.error.message).toBe("password=[redacted] postgresql://[redacted] failed for [email]");
    expect(logs.text()).not.toContain("hunter2");
  });

  it("records audit events and analytics for mutations, scoped to the actor", async () => {
    const { app, logs, audit } = await createApp();
    const created = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload: { name: "Next.js", type: "framework", notes: privateNotes, preference: { slot: "frontend.framework", mode: "LOCKED" } } });
    expect(created.statusCode).toBe(201);
    const requestId = created.headers["x-request-id"];
    expect(audit.events.map((event) => event.action)).toEqual(["resource.created", "resource.preference_changed"]);
    expect(audit.events[0]).toMatchObject({ actorUserId: ownerA, entityType: "resource", entityId: resource.id, requestId, metadata: { type: "framework", warnings: [] } });
    expect(audit.events[1]?.metadata).toEqual({ slot: "frontend.framework", mode: "LOCKED" });
    expect(JSON.stringify(audit.events)).not.toContain(privateNotes);
    expect(JSON.stringify(audit.events)).not.toContain("Next.js");
    const analytics = logs.lines.filter((line) => line.category === "analytics");
    expect(analytics.map((line) => line.event)).toEqual(["resource_created", "resource_preference_set"]);
    expect(analytics[0]).toMatchObject({ userId: ownerA, requestId, properties: { type: "framework" } });
    expect(logs.text()).not.toContain(privateNotes);

    await app.inject({ method: "POST", url: `/v1/projects/${projectId}/compile`, headers: headersA });
    await app.inject({ method: "POST", url: `/v1/projects/${projectId}/exports`, headers: headersA, payload: { target: "agents" } });
    expect(audit.events.slice(2).map((event) => [event.action, event.metadata])).toEqual([
      ["project.compiled", { version: 1, compilerVersion: "0.4.0", decisions: 0, warnings: 0 }],
      ["project.exported", { target: "agents", version: 1 }],
    ]);
    expect(logs.lines.filter((line) => line.category === "analytics").map((line) => line.event)).toContain("context_compiled");

    const own = await app.inject({ url: "/v1/audit?entityType=project&limit=5", headers: headersA });
    expect(auditEventListResponseSchema.parse(own.json()).events.map((event) => event.action)).toEqual(["project.exported", "project.compiled"]);
    const foreign = await app.inject({ url: "/v1/audit", headers: { cookie: "session=owner-b" } });
    expect(auditEventListResponseSchema.parse(foreign.json()).events).toEqual([]);
    expect((await app.inject("/v1/audit")).statusCode).toBe(401);
    expect((await app.inject({ url: "/v1/audit?limit=500", headers: headersA })).statusCode).toBe(400);
  });

  it("never fails a user action because the audit write failed", async () => {
    const audit = memoryAudit();
    audit.record = vi.fn(async () => { throw new Error("postgresql://devcontext:hunter2@db.internal/devcontext unreachable"); });
    const { app, logs } = await createApp({ audit });
    const response = await app.inject({ method: "POST", url: "/v1/resources", headers: headersA, payload: { name: "Next.js", type: "framework" } });
    expect(response.statusCode).toBe(201);
    expect(logs.lines.find((line) => line.category === "audit")).toMatchObject({ action: "resource.created" });
    expect(logs.text()).not.toContain("hunter2");
  });

  it("audits account creation from the auth proxy and logs sign-in outcomes without credentials", async () => {
    const { app, logs, audit } = await createApp();
    const signedUp = await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { name: "Owner", email: "owner-a@example.test", password: "correct horse battery staple" } });
    expect(signedUp.statusCode).toBe(200);
    expect(String(signedUp.headers["set-cookie"])).toContain("devcontext.session_token=");
    expect(audit.events).toEqual([expect.objectContaining({ actorUserId: ownerA, action: "account.created", entityType: "account", entityId: ownerA })]);
    expect(logs.lines.find((line) => line.event === "auth_sign_up")).toMatchObject({ category: "security", userId: ownerA });
    expect(logs.lines.find((line) => line.category === "analytics")).toMatchObject({ event: "signup_completed", userId: ownerA });
    const rejected = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email: "owner-a@example.test", password: "correct horse battery staple" } });
    expect(rejected.statusCode).toBe(401);
    expect(logs.lines.find((line) => line.event === "auth_rejected")).toMatchObject({ category: "security", route: "/api/auth/*", statusCode: 401 });
    const text = logs.text();
    expect(text).not.toContain("correct horse battery staple");
    expect(text).not.toContain("owner-a@example.test");
    expect(text).not.toContain("opaque-session-token-value");
  });
});
