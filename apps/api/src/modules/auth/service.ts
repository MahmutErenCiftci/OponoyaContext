import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import type { CurrentUser } from "@devcontext/contracts";
import type { Database } from "@devcontext/db";
import * as schema from "@devcontext/db/schema";
import type { AppConfig } from "../../config.js";

export type AuthSession = {
  user: CurrentUser;
};

export type AuthProvider = {
  handler(request: Request): Promise<Response>;
  getSession(headers: Headers): Promise<AuthSession | null>;
  /** Re-checks the signed-in user's password without changing anything; false on a mismatch. */
  verifyPassword(headers: Headers, password: string): Promise<boolean>;
  /**
   * Deletes the signed-in user through Better Auth: credential check, user row,
   * every session and the cookie. The database cascades remove all owned rows
   * in the same statement, so nothing private survives the user row.
   */
  deleteUser(headers: Headers, password: string): Promise<{ setCookie: string[] }>;
};

function isInvalidPassword(error: unknown) {
  if (!(error instanceof APIError)) return false;
  const body: unknown = error.body;
  return typeof body === "object" && body !== null && "code" in body && body.code === "INVALID_PASSWORD";
}

export function createAuthProvider(database: Database, config: AppConfig): AuthProvider {
  const auth = betterAuth({
    appName: "DevContext OS",
    database: drizzleAdapter(database.db, {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    baseURL: config.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      // Deletion is only reachable through the account service, which re-checks the password and revokes billing first.
      deleteUser: { enabled: true },
    },
    rateLimit: {
      // Playwright signs up one user per journey in parallel; production keeps the limits.
      enabled: config.NODE_ENV !== "test",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "devcontext",
      database: { generateId: "uuid" },
    },
  });

  return {
    handler: auth.handler,
    async getSession(headers) {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image ?? null,
        },
      };
    },
    async verifyPassword(headers, password) {
      try {
        const result = await auth.api.verifyPassword({ headers, body: { password } });
        return Boolean(result?.status);
      } catch (error) {
        if (isInvalidPassword(error)) return false;
        throw error;
      }
    },
    async deleteUser(headers, password) {
      try {
        const { headers: responseHeaders } = await auth.api.deleteUser({ headers, body: { password }, returnHeaders: true });
        return { setCookie: responseHeaders.getSetCookie() };
      } catch (error) {
        if (isInvalidPassword(error)) {
          throw Object.assign(new Error("Invalid password"), {
            statusCode: 400,
            details: [{ path: ["password"], code: "invalid_password" }],
            publicMessage: "The password is not correct. Nothing was deleted.",
          });
        }
        throw error;
      }
    },
  };
}
