import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { productName, type CurrentUser } from "@devcontext/contracts";
import type { Database } from "@devcontext/db";
import * as schema from "@devcontext/db/schema";
import type { AppConfig } from "../../config.js";
import { clientIpHeader } from "../../lib/client-ip.js";
import { redactText } from "../../lib/redact.js";
import type { EmailSender } from "../email/sender.js";

/** Structured sink for Better Auth's own messages (pino in the app). */
export type AuthLogSink = {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

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
  /**
   * Checks the current password, stores the new one and signs out every other
   * session; the returned cookie replaces the caller's own session.
   */
  changePassword(headers: Headers, currentPassword: string, newPassword: string): Promise<{ setCookie: string[] }>;
};

function isInvalidPassword(error: unknown) {
  if (!(error instanceof APIError)) return false;
  const body: unknown = error.body;
  return typeof body === "object" && body !== null && "code" in body && body.code === "INVALID_PASSWORD";
}

/** Reset links are valid for one hour and can be used once (Better Auth consumes the token). */
export const passwordResetTokenSeconds = 3_600;

/** The link in the e-mail opens the web app's reset page directly; the token travels in the query string only. */
export function passwordResetLink(webOrigin: string, token: string) {
  const url = new URL("/auth/reset", webOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createAuthProvider(database: Database, config: AppConfig, logSink?: AuthLogSink, emailSender?: EmailSender | null): AuthProvider {
  const auth = betterAuth({
    appName: productName,
    // Library messages go through the redacting structured logger; extra arguments (errors with query parameters) are dropped.
    logger: {
      level: "warn",
      log: (level, message) => {
        if (!logSink) return;
        const payload = { category: "auth_library", message: redactText(String(message), 300) };
        if (level === "error") logSink.error(payload, "auth_library");
        else if (level === "warn") logSink.warn(payload, "auth_library");
        else logSink.info(payload, "auth_library");
      },
    },
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
      // Password reset exists only with an e-mail sender; otherwise its routes are not proxied at all.
      ...(emailSender ? {
        resetPasswordTokenExpiresIn: passwordResetTokenSeconds,
        // A reset ends every session, so a stolen session does not survive the owner taking the account back.
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, token }: { user: { email: string }; token: string }) => {
          const link = passwordResetLink(config.CORS_ORIGIN, token);
          await emailSender.send({
            to: user.email,
            subject: `${productName} şifre sıfırlama`,
            text: [
              "Merhaba,",
              "",
              `${productName} hesabın için şifre sıfırlama istendi. Yeni şifreni belirlemek için bu bağlantıyı aç (1 saat geçerli, tek kullanımlık):`,
              link,
              "",
              "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.",
            ].join("\n"),
          });
        },
        onPasswordReset: async ({ user }: { user: { id: string } }) => {
          logSink?.info({ category: "security", event: "password_reset", userId: user.id }, "password_reset");
        },
      } : {}),
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
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },
    // Defence in depth behind the route allow-list: these must never be reachable over HTTP.
    disabledPaths: ["/delete-user", "/delete-user/callback", "/update-user", "/change-email", "/list-sessions", "/list-accounts"],
    advanced: {
      cookiePrefix: "devcontext",
      database: { generateId: "uuid" },
      // Set by the API from the verified web-proxy assertion or the socket; a client-written value never reaches here.
      ipAddress: { ipAddressHeaders: [clientIpHeader] },
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
    async changePassword(headers, currentPassword, newPassword) {
      try {
        const { headers: responseHeaders } = await auth.api.changePassword({ headers, body: { currentPassword, newPassword, revokeOtherSessions: true }, returnHeaders: true });
        return { setCookie: responseHeaders.getSetCookie() };
      } catch (error) {
        if (isInvalidPassword(error)) {
          throw Object.assign(new Error("Invalid password"), {
            statusCode: 400,
            details: [{ path: ["currentPassword"], code: "invalid_password" }],
            publicMessage: "The current password is not correct. Nothing was changed.",
          });
        }
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
