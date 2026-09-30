import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, eq, sessions, users, type Database } from "@devcontext/db";
import { createTestDatabase } from "@devcontext/db/testing";
import { readConfig } from "../src/config.js";
import { createAuthProvider, passwordResetLink, type AuthProvider } from "../src/modules/auth/service.js";
import type { EmailMessage, EmailSender } from "../src/modules/email/sender.js";

/**
 * The real Better Auth flow on real SQL: request a link, reset with the token,
 * old password and sessions stop working, the token cannot be replayed, and an
 * unknown address is answered exactly like a known one.
 */
const config = readConfig({ NODE_ENV: "test", DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test", CORS_ORIGIN: "http://localhost:3000", BETTER_AUTH_URL: "http://localhost:4000" });
const outbox: EmailMessage[] = [];
const sender: EmailSender = { id: "log", async send(message) { outbox.push(message); } };

let database: Pick<Database, "db" | "close">;
let auth: AuthProvider;

function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(new Request(`http://localhost:4000/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }));
}

function cookieOf(response: Response) {
  return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
}

function tokenFrom(message: EmailMessage) {
  const link = /https?:\/\/\S+/.exec(message.text)?.[0];
  return link ? new URL(link).searchParams.get("token") : null;
}

beforeAll(async () => {
  database = await createTestDatabase();
  auth = createAuthProvider(database as unknown as Database, config, undefined, sender);
}, 60_000);

afterAll(async () => {
  await database.close();
});

describe("password reset", () => {
  it("builds the link to the web app's reset page", () => {
    expect(passwordResetLink("https://app.example.test", "abc123")).toBe("https://app.example.test/auth/reset?token=abc123");
  });

  it("resets the password once, ends every session and never reveals whether an address exists", async () => {
    const signUp = await post("/sign-up/email", { email: "owner@example.test", password: "old password 1", name: "Owner" });
    expect(signUp.status).toBe(200);
    const cookie = cookieOf(signUp);
    expect(await auth.getSession(new Headers({ cookie }))).not.toBeNull();

    const known = await post("/request-password-reset", { email: "owner@example.test" });
    const unknown = await post("/request-password-reset", { email: "nobody@example.test" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: "owner@example.test", subject: expect.stringContaining("şifre sıfırlama") });
    expect(outbox[0]!.text).toContain("http://localhost:3000/auth/reset?token=");
    const token = tokenFrom(outbox[0]!);
    expect(token).toBeTruthy();

    expect((await post("/reset-password", { newPassword: "short", token })).status).toBe(400);
    const reset = await post("/reset-password", { newPassword: "new password 2", token });
    expect(reset.status).toBe(200);

    // Every session of the account ended with the reset.
    expect(await auth.getSession(new Headers({ cookie }))).toBeNull();
    const [user] = await database.db.select({ id: users.id }).from(users).where(eq(users.email, "owner@example.test"));
    expect((await database.db.select({ value: count() }).from(sessions).where(eq(sessions.userId, user!.id)))[0]!.value).toBe(0);

    expect((await post("/sign-in/email", { email: "owner@example.test", password: "old password 1" })).status).toBe(401);
    expect((await post("/sign-in/email", { email: "owner@example.test", password: "new password 2" })).status).toBe(200);

    // The token is single-use.
    const replay = await post("/reset-password", { newPassword: "third password 3", token });
    expect(replay.status).toBe(400);
    expect(await replay.json()).toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("is refused by Better Auth when no sender is configured", async () => {
    const withoutSender = createAuthProvider(database as unknown as Database, config);
    const response = await withoutSender.handler(new Request("http://localhost:4000/api/auth/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "owner@example.test" }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "RESET_PASSWORD_DISABLED" });
  });
});
