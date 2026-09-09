import { afterEach, describe, expect, it, vi } from "vitest";
import { Writable } from "node:stream";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import { createProjectSchema, apiErrorSchema, currentUserResponseSchema } from "@devcontext/contracts";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { registerErrorHandlers } from "../src/errors.js";
import type { AuthProvider } from "../src/modules/auth/service.js";
import { memoryAudit } from "./support/memory-audit.js";

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

const testUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "owner@example.test",
  name: "Project Owner",
  image: null,
};

function fakeAuth(): AuthProvider {
  return {
    async handler() {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json", "set-cookie": "session=valid; Path=/; HttpOnly" },
      });
    },
    async getSession(headers) {
      return headers.get("cookie")?.includes("session=valid") ? { user: testUser } : null;
    },
    async verifyPassword() { return true; },
    async deleteUser() { return { setCookie: [] }; },
  };
}

async function createApp(auth: AuthProvider = fakeAuth()) {
  const app = await buildApp(readConfig({
    NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
  }), { auth, audit: memoryAudit() });
  apps.push(app);
  return app;
}

describe("API foundation", () => {
  it("serves liveness and configured CORS through the full application", async () => {
    const app = await createApp();
    const response = await app.inject({ url: "/health", headers: { origin: "http://localhost:3000" } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.json()).toMatchObject({ ok: true, service: "devcontext-api" });
  });
  it("requires an authenticated session for project writes", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "POST", url: "/v1/projects", payload: { name: "Private" } });
    expect(response.statusCode).toBe(401);
    expect(apiErrorSchema.parse(response.json()).error.code).toBe("UNAUTHORIZED");
  });
  it("resolves the current user from the session and ignores spoofed owner headers", async () => {
    const app = await createApp();
    const anonymous = await app.inject({
      url: "/v1/me",
      headers: { "x-owner-user-id": testUser.id },
    });
    expect(anonymous.statusCode).toBe(401);
    expect(apiErrorSchema.parse(anonymous.json()).error.code).toBe("UNAUTHORIZED");

    const authenticated = await app.inject({
      url: "/v1/me",
      headers: { cookie: "session=valid", "x-owner-user-id": "00000000-0000-4000-8000-000000000002" },
    });
    expect(authenticated.statusCode).toBe(200);
    expect(currentUserResponseSchema.parse(authenticated.json()).user).toEqual(testUser);
  });
  it("forwards auth responses and session cookies", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: {} });
    expect(response.statusCode).toBe(200);
    expect(String(response.headers["set-cookie"])).toContain("session=valid");
  });
  it("reports database readiness separately from liveness", async () => {
    const app = await createApp();
    vi.spyOn(app.database.pool, "query").mockRejectedValueOnce(new Error("private credentials"));
    const response = await app.inject("/ready");
    expect(response.statusCode).toBe(503);
    expect(apiErrorSchema.parse(response.json()).error.code).toBe("SERVICE_UNAVAILABLE");
    expect(response.body).not.toContain("private credentials");
  });
  it("closes the database pool with the application", async () => {
    const app = await createApp();
    const close = vi.spyOn(app.database, "close");
    await app.close();
    expect(close).toHaveBeenCalledOnce();
  });
  it("normalizes validation, JSON parser and unexpected errors without leaking data", async () => {
    const logs: string[] = [];
    const stream = new Writable({ write(chunk, _encoding, callback) { logs.push(String(chunk)); callback(); } });
    const app = Fastify({ logger: { stream }, logController: new LogController({ disableRequestLogging: true }) });
    apps.push(app);
    registerErrorHandlers(app);
    app.post("/validate", (request) => createProjectSchema.parse(request.body));
    app.get("/crash", () => { throw new Error("password=super-secret SELECT private_data"); });

    const invalid = await app.inject({ method: "POST", url: "/validate", payload: { name: "" } });
    expect(invalid.statusCode).toBe(400);
    expect(apiErrorSchema.parse(invalid.json()).error.details?.[0]?.path).toEqual(["name"]);
    const malformed = await app.inject({ method: "POST", url: "/validate", headers: { "content-type": "application/json" }, payload: '{"secret-token":' });
    expect(malformed.statusCode).toBe(400);
    expect(apiErrorSchema.parse(malformed.json()).error.code).toBe("VALIDATION_ERROR");
    const failed = await app.inject("/crash");
    expect(failed.statusCode).toBe(500);
    expect(apiErrorSchema.parse(failed.json()).error.code).toBe("INTERNAL_ERROR");
    for (const secret of ["super-secret", "private_data", "secret-token"]) {
      expect(failed.body + malformed.body + logs.join("")).not.toContain(secret);
    }
  });
});
