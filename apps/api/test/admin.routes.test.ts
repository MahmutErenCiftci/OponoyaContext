import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  adminFeedbackListResponseSchema,
  adminOverviewResponseSchema,
  apiErrorSchema,
  currentUserResponseSchema,
  feedbackListResponseSchema,
  feedbackResponseSchema,
  type AdminOverview,
  type Feedback,
} from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { RateLimitPolicy } from "../src/lib/rate-limit.js";
import type { AdminRepository } from "../src/modules/admin/repository.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import type { FeedbackRepository } from "../src/modules/feedback/repository.js";
import { memoryAudit } from "./support/memory-audit.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const adminId = "00000000-0000-4000-8000-0000000000aa";
const memberId = "00000000-0000-4000-8000-0000000000bb";
const asAdmin = { cookie: "session=admin" };
const asMember = { cookie: "session=member" };

function auth(): AuthProvider {
  return {
    async handler() { return new Response(); },
    async getSession(headers) {
      const cookie = headers.get("cookie") ?? "";
      if (cookie.includes("session=admin")) return { user: { id: adminId, email: "ops@example.test", name: "Ops", image: null } };
      if (cookie.includes("session=member")) return { user: { id: memberId, email: "member@example.test", name: "Member", image: null } };
      return null;
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
    async changePassword() { return { setCookie: [] }; },
  };
}

const overview: AdminOverview = {
  generatedAt: "2026-10-04T10:00:00.000Z",
  timeZone: "Europe/Istanbul",
  users: { total: 2, last24h: 1, last7d: 2, last30d: 2, active7d: 1, active30d: 2, deleted: 0 },
  signupsByDay: [{ date: "2026-10-04", count: 1 }],
  funnel: { signedUp: 2, addedResource: 1, createdProject: 1, compiledContext: 0, exportedContext: 0, secondProject: 0 },
  totals: { projects: 1, resources: 1, profiles: 0, recipes: 0, contextVersions: 0, exports: 0, sampleInstalls: 0, proSubscriptions: 0 },
  feedback: { new: 0, reviewing: 0, resolved: 0, dismissed: 0 },
  recentUsers: [],
};

/** In-memory reports keyed like the real repository: own lists by author, triage across everyone. */
function memoryFeedback(): FeedbackRepository & { rows: Array<Feedback & { userId: string }> } {
  const rows: Array<Feedback & { userId: string }> = [];
  const strip = (row: Feedback & { userId: string }): Feedback => ({
    id: row.id, kind: row.kind, message: row.message, pagePath: row.pagePath, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt,
  });
  return {
    rows,
    async create(userId, input) {
      const row = {
        id: `00000000-0000-4000-8000-${String(rows.length + 1).padStart(12, "0")}`,
        userId, kind: input.kind, message: input.message, pagePath: input.pagePath ?? null, status: "new" as const,
        createdAt: "2026-10-04T10:00:00.000Z", updatedAt: "2026-10-04T10:00:00.000Z",
      };
      rows.push(row);
      return { feedback: strip(row), created: true };
    },
    async listOwn(userId) { return rows.filter((row) => row.userId === userId).map(strip); },
    async listAll({ status }) {
      return rows.filter((row) => status === "all" || row.status === status)
        .map((row) => ({ ...strip(row), user: { id: row.userId, name: "Member", email: "member@example.test" } }));
    },
    async setStatus(id, status) {
      const row = rows.find((entry) => entry.id === id);
      if (!row) return null;
      row.status = status;
      return strip(row);
    },
  };
}

async function createApp(rateLimits?: Partial<RateLimitPolicy>) {
  const audit = memoryAudit();
  const admin: AdminRepository = { overview: vi.fn(async () => overview) };
  const feedback = memoryFeedback();
  // Upper case on purpose: ids are compared case-insensitively.
  const config = readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test", ADMIN_USER_IDS: ` ${adminId.toUpperCase()} ` });
  const app = await buildApp(config, { auth: auth(), audit, admin, feedback, ...(rateLimits ? { rateLimits } : {}) });
  apps.push(app);
  return { app, audit, admin, feedback };
}

describe("operator access", () => {
  it("rejects a malformed ADMIN_USER_IDS and opens nothing by default", () => {
    const base = { NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" };
    expect(readConfig(base).ADMIN_USER_IDS).toEqual([]);
    expect(() => readConfig({ ...base, ADMIN_USER_IDS: "ops@example.test" })).toThrow(/ADMIN_USER_IDS/);
    expect(readConfig({ ...base, ADMIN_USER_IDS: `${adminId}, ${memberId},${adminId}` }).ADMIN_USER_IDS).toEqual([adminId, memberId]);
  });

  it("reports the admin flag on /v1/me", async () => {
    const { app } = await createApp();
    const admin = await app.inject({ url: "/v1/me", headers: asAdmin });
    expect(currentUserResponseSchema.parse(admin.json()).admin).toBe(true);
    const member = await app.inject({ url: "/v1/me", headers: asMember });
    expect(currentUserResponseSchema.parse(member.json()).admin).toBe(false);
  });

  it("serves the overview to admins only and queries nothing for anyone else", async () => {
    const { app, admin } = await createApp();
    const anonymous = await app.inject({ url: "/v1/admin/overview" });
    expect(anonymous.statusCode).toBe(401);
    const member = await app.inject({ url: "/v1/admin/overview", headers: asMember });
    expect(member.statusCode).toBe(403);
    expect(apiErrorSchema.parse(member.json()).error.code).toBe("FORBIDDEN");
    expect(admin.overview).not.toHaveBeenCalled();

    const allowed = await app.inject({ url: "/v1/admin/overview", headers: asAdmin });
    expect(allowed.statusCode).toBe(200);
    expect(adminOverviewResponseSchema.parse(allowed.json()).overview.users.total).toBe(2);
  });
});

describe("feedback", () => {
  it("files a report, reads it back and audits the kind but never the message", async () => {
    const { app, audit } = await createApp();
    const tooShort = await app.inject({ method: "POST", url: "/v1/feedback", headers: asMember, payload: { kind: "bug", message: "kısa" } });
    expect(tooShort.statusCode).toBe(400);
    const withQuery = await app.inject({ method: "POST", url: "/v1/feedback", headers: asMember, payload: { kind: "bug", message: "Kaydet düğmesi çalışmıyor.", pagePath: "/workspace?token=x" } });
    expect(withQuery.statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/feedback", payload: { kind: "bug", message: "Kaydet düğmesi çalışmıyor." } })).statusCode).toBe(401);

    const created = await app.inject({ method: "POST", url: "/v1/feedback", headers: asMember, payload: { kind: "bug", message: "  Kaydet düğmesi çalışmıyor.  ", pagePath: "/workspace/projects" } });
    expect(created.statusCode).toBe(201);
    expect(feedbackResponseSchema.parse(created.json()).feedback).toMatchObject({ kind: "bug", message: "Kaydet düğmesi çalışmıyor.", status: "new", pagePath: "/workspace/projects" });
    expect(audit.events).toEqual([expect.objectContaining({ actorUserId: memberId, action: "feedback.created", entityType: "feedback", metadata: { kind: "bug" } })]);

    const own = await app.inject({ url: "/v1/feedback", headers: asMember });
    expect(feedbackListResponseSchema.parse(own.json()).feedback).toHaveLength(1);
    const otherUser = await app.inject({ url: "/v1/feedback", headers: asAdmin });
    expect(feedbackListResponseSchema.parse(otherUser.json()).feedback).toEqual([]);
  });

  it("lets only admins list and triage reports", async () => {
    const { app, audit, feedback } = await createApp();
    await app.inject({ method: "POST", url: "/v1/feedback", headers: asMember, payload: { kind: "suggestion", message: "Karanlık tema için daha koyu bir yan menü." } });
    const id = feedback.rows[0]!.id;

    expect((await app.inject({ url: "/v1/admin/feedback", headers: asMember })).statusCode).toBe(403);
    expect((await app.inject({ method: "PATCH", url: `/v1/admin/feedback/${id}`, headers: asMember, payload: { status: "resolved" } })).statusCode).toBe(403);
    expect(feedback.rows[0]!.status).toBe("new");

    const inbox = await app.inject({ url: "/v1/admin/feedback?status=new", headers: asAdmin });
    expect(adminFeedbackListResponseSchema.parse(inbox.json()).feedback.map((item) => item.user.email)).toEqual(["member@example.test"]);

    expect((await app.inject({ method: "PATCH", url: `/v1/admin/feedback/${id}`, headers: asAdmin, payload: { status: "closed" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: "/v1/admin/feedback/00000000-0000-4000-8000-0000000000ff", headers: asAdmin, payload: { status: "resolved" } })).statusCode).toBe(404);
    const resolved = await app.inject({ method: "PATCH", url: `/v1/admin/feedback/${id}`, headers: asAdmin, payload: { status: "resolved" } });
    expect(resolved.statusCode).toBe(200);
    expect(feedbackResponseSchema.parse(resolved.json()).feedback.status).toBe("resolved");
    expect(audit.events.at(-1)).toMatchObject({ actorUserId: adminId, action: "feedback.status_changed", entityId: id, metadata: { status: "resolved" } });

    const remaining = await app.inject({ url: "/v1/admin/feedback", headers: asAdmin });
    expect(adminFeedbackListResponseSchema.parse(remaining.json()).feedback).toEqual([]);
  });

  it("throttles report bursts per user with their own rule", async () => {
    const { app } = await createApp({ feedback: { name: "feedback", max: 2, windowMs: 60_000 } });
    const send = (message: string) => app.inject({ method: "POST", url: "/v1/feedback", headers: asMember, payload: { kind: "other", message } });
    expect((await send("Birinci geri bildirim.")).statusCode).toBe(201);
    expect((await send("İkinci geri bildirim.")).statusCode).toBe(201);
    const third = await send("Üçüncü geri bildirim.");
    expect(third.statusCode).toBe(429);
    // Reads stay on the ordinary read rule.
    expect((await app.inject({ url: "/v1/feedback", headers: asMember })).statusCode).toBe(200);
  });
});
