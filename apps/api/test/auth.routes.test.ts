import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authOptionsResponseSchema } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import type { EmailSender } from "../src/modules/email/sender.js";
import { memoryAudit } from "./support/memory-audit.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const base = { NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" };

function recordingAuth(seen: string[]): AuthProvider {
  return {
    async handler(request) {
      seen.push(`${request.method} ${new URL(request.url).pathname}`);
      return new Response(JSON.stringify({ status: true }), { headers: { "content-type": "application/json" } });
    },
    async getSession() { return null; },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
    async changePassword() { return { setCookie: [] }; },
  };
}

async function createApp(emailSender: EmailSender | null, seen: string[]) {
  const app = await buildApp(readConfig(base), { auth: recordingAuth(seen), audit: memoryAudit(), emailSender });
  apps.push(app);
  return app;
}

const sender: EmailSender = { id: "log", async send() {} };

describe("password reset routes", () => {
  it("stay unreachable and are reported as off without an e-mail sender", async () => {
    const seen: string[] = [];
    const app = await createApp(null, seen);
    expect(authOptionsResponseSchema.parse((await app.inject("/v1/auth/options")).json())).toEqual({ options: { passwordReset: false } });
    expect((await app.inject({ method: "POST", url: "/api/auth/request-password-reset", payload: { email: "a@example.test" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/auth/reset-password", payload: { newPassword: "new password 2", token: "t".repeat(24) } })).statusCode).toBe(404);
    expect(seen).toEqual([]);
  });

  it("reach Better Auth only for the two reset endpoints once a sender exists", async () => {
    const seen: string[] = [];
    const app = await createApp(sender, seen);
    expect(authOptionsResponseSchema.parse((await app.inject("/v1/auth/options")).json()).options.passwordReset).toBe(true);
    expect((await app.inject({ method: "POST", url: "/api/auth/request-password-reset", payload: { email: "a@example.test" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/auth/reset-password", payload: { newPassword: "new password 2", token: "t".repeat(24) } })).statusCode).toBe(200);
    // The link callback and every other Better Auth path stay closed.
    expect((await app.inject(`/api/auth/reset-password/${"t".repeat(24)}?callbackURL=https://evil.example`)).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/auth/forget-password", payload: { email: "a@example.test" } })).statusCode).toBe(404);
    expect(seen).toEqual(["POST /api/auth/request-password-reset", "POST /api/auth/reset-password"]);
  });
});

describe("e-mail configuration", () => {
  it("refuses the log provider in production and accepts it elsewhere", () => {
    const production = {
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.test:5432/app?sslmode=verify-full",
      CORS_ORIGIN: "https://app.example.test",
      BETTER_AUTH_URL: "https://api.example.test",
      BETTER_AUTH_SECRET: "a-real-production-secret-with-enough-length-0001",
      WEB_PROXY_SECRET: "a-real-proxy-secret-with-enough-length-000000001",
    };
    expect(() => readConfig(production)).not.toThrow();
    expect(() => readConfig({ ...production, EMAIL_PROVIDER: "log" })).toThrow(/EMAIL_PROVIDER/);
    expect(readConfig({ ...base, EMAIL_PROVIDER: "log", EMAIL_OUTBOX_FILE: "tmp/outbox.jsonl" })).toMatchObject({ EMAIL_PROVIDER: "log", EMAIL_OUTBOX_FILE: "tmp/outbox.jsonl" });
    expect(readConfig(base).EMAIL_PROVIDER).toBe("none");
  });
});
