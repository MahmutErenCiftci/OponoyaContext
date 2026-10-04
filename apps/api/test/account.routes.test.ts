import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  apiErrorSchema,
  changePasswordResponseSchema,
  deleteAccountResponseSchema,
  legalConfigResponseSchema,
  type AccountExport,
  type CurrentUser,
} from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { RateLimitPolicy } from "../src/lib/rate-limit.js";
import { invalidPasswordError, legalConfigFrom, type AccountService } from "../src/modules/account/service.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { billingRevocationError } from "../src/modules/billing/provider.js";
import { memoryAudit } from "./support/memory-audit.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const ownerA = "00000000-0000-4000-8000-000000000001";
const headersA = { cookie: "session=owner-a" };
const config = readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" });

function auth(changePassword = vi.fn(async (...[, current]: [Headers, string, string]) => {
  if (current !== "old password 1") throw Object.assign(new Error("Invalid password"), { statusCode: 400, details: [{ path: ["currentPassword"], code: "invalid_password" }], publicMessage: "The current password is not correct. Nothing was changed." });
  return { setCookie: ["better-auth.session_token=renewed; Path=/; HttpOnly; SameSite=Lax"] };
})): AuthProvider & { changePassword: typeof changePassword } {
  return {
    async handler() { return new Response(); },
    async getSession(headers) {
      return headers.get("cookie")?.includes("session=owner-a") ? { user: { id: ownerA, email: "a@example.test", name: "Owner A", image: null } } : null;
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
    changePassword,
  };
}

const exported = {
  format: "devcontext.account-export",
  version: 1,
  exportedAt: "2026-09-26T10:00:00.000Z",
  workspace: { resources: [{}, {}], projects: [{}] },
  contextVersions: [],
  auditEvents: [{}],
} as unknown as AccountExport;

function account(): AccountService {
  return {
    summary: vi.fn(),
    exportAccount: vi.fn(async () => exported),
    deleteAccount: vi.fn(async (_user: CurrentUser, input) => {
      if (input.password === "offline") throw billingRevocationError("billing_provider_unavailable");
      if (input.password === "wrong") throw invalidPasswordError();
      return { deletion: { status: "completed" as const, attempts: 1, requestedAt: "2026-09-26T10:00:00.000Z", lastAttemptAt: "2026-09-26T10:00:00.000Z", lastError: null, retryable: false }, setCookie: ["better-auth.session_token=; Max-Age=0; Path=/"] };
    }),
    legal: vi.fn(() => legalConfigFrom(config, { id: null, testMode: false })),
  };
}

async function createApp(options: { provider?: ReturnType<typeof auth>; rateLimits?: Partial<RateLimitPolicy> } = {}) {
  const audit = memoryAudit();
  const provider = options.provider ?? auth();
  const service = account();
  const app = await buildApp(config, { auth: provider, account: service, audit, ...(options.rateLimits ? { rateLimits: options.rateLimits } : {}) });
  apps.push(app);
  return { app, audit, provider, service };
}

describe("account routes", () => {
  it("serves the legal configuration publicly as an unapproved draft", async () => {
    const { app } = await createApp();
    const legal = legalConfigResponseSchema.parse((await app.inject("/v1/legal")).json()).legal;
    expect(legal).toMatchObject({ productName: "hooliee", draft: true, approvedAt: null });
  });

  it("downloads the export as an attachment and records only counts", async () => {
    const { app, audit } = await createApp();
    expect((await app.inject("/v1/account/export")).statusCode).toBe(401);
    const response = await app.inject({ url: "/v1/account/export", headers: headersA });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toBe('attachment; filename="devcontext-account-2026-09-26.json"');
    expect(response.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(audit.events).toEqual([expect.objectContaining({ action: "account.export_downloaded", metadata: { resources: 2, projects: 1, contextVersions: 0, auditEvents: 1 } })]);
  });

  it("changes the password, renews this session and never logs the passwords", async () => {
    const { app, audit, provider } = await createApp();
    const payload = { currentPassword: "old password 1", newPassword: "new password 2" };
    expect((await app.inject({ method: "PUT", url: "/v1/account/password", payload })).statusCode).toBe(401);
    const response = await app.inject({ method: "PUT", url: "/v1/account/password", headers: headersA, payload });
    expect(response.statusCode).toBe(200);
    expect(changePasswordResponseSchema.parse(response.json())).toEqual({ changed: true, otherSessionsRevoked: true });
    expect(String(response.headers["set-cookie"])).toContain("better-auth.session_token=renewed");
    expect(provider.changePassword).toHaveBeenCalledWith(expect.any(Headers), "old password 1", "new password 2");
    expect(audit.events).toEqual([expect.objectContaining({ action: "account.password_changed", metadata: { otherSessionsRevoked: true } })]);
    expect(JSON.stringify(audit.events)).not.toContain("password 1");
  });

  it("validates the new password before asking the auth library", async () => {
    const { app, provider } = await createApp();
    const change = (payload: Record<string, unknown>) => app.inject({ method: "PUT", url: "/v1/account/password", headers: headersA, payload });
    expect((await change({ currentPassword: "old password 1", newPassword: "short" })).statusCode).toBe(400);
    expect((await change({ currentPassword: "same password", newPassword: "same password" })).statusCode).toBe(400);
    expect((await change({ currentPassword: "old password 1", newPassword: "x".repeat(129) })).statusCode).toBe(400);
    expect(provider.changePassword).not.toHaveBeenCalled();
    const wrong = await change({ currentPassword: "wrong password", newPassword: "new password 2" });
    expect(wrong.statusCode).toBe(400);
    expect(apiErrorSchema.parse(wrong.json()).error.details).toEqual([{ path: ["currentPassword"], code: "invalid_password" }]);
  });

  it("rate limits password checks on the sensitive rule", async () => {
    const { app } = await createApp({ rateLimits: { sensitive: { name: "sensitive", max: 2, windowMs: 60_000 } } });
    const attempt = () => app.inject({ method: "PUT", url: "/v1/account/password", headers: headersA, payload: { currentPassword: "guess one", newPassword: "new password 2" } });
    expect((await attempt()).statusCode).toBe(400);
    expect((await attempt()).statusCode).toBe(400);
    expect((await attempt()).statusCode).toBe(429);
  });

  it("deletes the account, clears the cookie and explains a blocked deletion", async () => {
    const { app, audit } = await createApp();
    const remove = (password: string) => app.inject({ method: "DELETE", url: "/v1/account", headers: headersA, payload: { confirmation: "a@example.test", password } });
    const blocked = await remove("offline");
    expect(blocked.statusCode).toBe(409);
    expect(apiErrorSchema.parse(blocked.json()).error.details).toEqual([{ path: ["billing"], code: "billing_provider_unavailable" }]);
    expect(audit.events).toEqual([expect.objectContaining({ action: "account.deletion_blocked", metadata: { code: "billing_provider_unavailable" } })]);
    expect((await remove("wrong")).statusCode).toBe(400);
    const deleted = await remove("right password");
    expect(deleteAccountResponseSchema.parse(deleted.json()).deletion.status).toBe("completed");
    expect(String(deleted.headers["set-cookie"])).toContain("Max-Age=0");
  });
});
