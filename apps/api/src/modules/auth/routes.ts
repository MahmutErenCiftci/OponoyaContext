import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { CurrentUser } from "@devcontext/contracts";
import { applyRateLimitHeaders, rateLimitedError, ruleForRoute, type RateLimiter, type RateLimitPolicy } from "../../lib/rate-limit.js";
import type { Telemetry } from "../telemetry/service.js";
import type { AuthProvider } from "./service.js";

export type AuthRouteOptions = {
  limiter: RateLimiter;
  policy: RateLimitPolicy;
  telemetry: Telemetry;
  /** True when an e-mail sender is configured; only then are the reset endpoints reachable. */
  passwordReset?: boolean;
};

/**
 * Better Auth endpoints the product uses over HTTP. Everything else it can
 * serve (user deletion, profile or e-mail updates, session listing, social
 * callbacks) answers 404: account changes go through the API's own routes,
 * where the typed confirmation, password re-check, billing revocation and
 * audit trail live.
 */
export const allowedAuthEndpoints = new Set(["POST /sign-in/email", "POST /sign-up/email", "POST /sign-out"]);

/** Added to the allow-list only with an e-mail sender: request a link (always answers alike), then set a new password with its token. */
export const passwordResetEndpoints = new Set(["POST /request-password-reset", "POST /reset-password"]);

function authenticationError() {
  return Object.assign(new Error("Authentication required"), { statusCode: 401 });
}

function requestBody(request: FastifyRequest): BodyInit | undefined {
  if (["GET", "HEAD"].includes(request.method) || request.body === undefined) return undefined;
  if (typeof request.body === "string") return request.body;
  return JSON.stringify(request.body);
}

function sendAuthResponse(response: Response, body: Buffer, reply: FastifyReply) {
  reply.code(response.status);
  response.headers.forEach((value, key) => {
    if (key !== "set-cookie") reply.header(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) reply.header("set-cookie", cookies);
  return body.length > 0 ? reply.send(body) : reply.send();
}

/** Better Auth answers sign-in/sign-up with `{ token, user }`; only the id is read, nothing is retained. */
function readUserId(body: Buffer): string | null {
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || !("user" in parsed)) return null;
    const user = parsed.user;
    if (typeof user !== "object" || user === null || !("id" in user)) return null;
    return typeof user.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthProvider, options: AuthRouteOptions) {
  const allowed = new Set([...allowedAuthEndpoints, ...(options.passwordReset ? passwordResetEndpoints : [])]);

  /** Public: which optional sign-in features this deployment offers, so the web app never links to a dead end. */
  app.get("/v1/auth/options", async () => ({ options: { passwordReset: Boolean(options.passwordReset) } }));

  app.decorateRequest("currentUser", null);
  /**
   * Resolves the session and applies the per-user rate limit for the matched
   * route. Anonymous requests never reach a bucket: they fail first with 401.
   */
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await auth.getSession(fromNodeHeaders(request.headers));
    if (!session) throw authenticationError();
    request.currentUser = session.user;
    const rule = ruleForRoute(options.policy, request.method, request.routeOptions.url);
    request.rateLimitRule = rule.name;
    const verdict = options.limiter.consume(rule, `user:${session.user.id}`);
    applyRateLimitHeaders(reply, verdict);
    if (!verdict.allowed) throw rateLimitedError();
  });

  app.all("/api/auth/*", {
    // Sign-in, sign-up and sign-out are anonymous, so the bucket is the client IP.
    onRequest: async (request, reply) => {
      if (request.method === "GET" || request.method === "HEAD") return;
      request.rateLimitRule = options.policy.auth.name;
      const verdict = options.limiter.consume(options.policy.auth, `ip:${request.clientIp || request.ip}`);
      applyRateLimitHeaders(reply, verdict);
      if (!verdict.allowed) throw rateLimitedError();
    },
  }, async (request, reply) => {
    // Only the path and query travel on: an absolute-form request line cannot choose another origin for Better Auth.
    const requested = new URL(request.raw.url ?? request.url, "http://request.invalid");
    const url = new URL(`${requested.pathname}${requested.search}`, app.config.BETTER_AUTH_URL);
    const endpoint = url.pathname.startsWith("/api/auth/") ? url.pathname.slice("/api/auth".length) : url.pathname;
    if (!allowed.has(`${request.method} ${endpoint}`)) {
      throw Object.assign(new Error("Auth endpoint not available"), { statusCode: 404 });
    }
    const init: RequestInit = {
      method: request.method,
      headers: fromNodeHeaders(request.headers),
    };
    const body = requestBody(request);
    if (body !== undefined) init.body = body;
    const response = await auth.handler(new Request(url, init));
    const payload = Buffer.from(await response.arrayBuffer());
    if (request.method === "POST" && response.status === 200) {
      if (url.pathname.endsWith("/sign-up/email")) {
        const userId = readUserId(payload);
        if (userId) {
          await options.telemetry.record({ actorUserId: userId, requestId: request.id }, {
            action: "account.created", entityType: "account", entityId: userId, analytics: "signup_completed",
          });
          request.log.info({ category: "security", event: "auth_sign_up", userId, requestId: request.id }, "auth_sign_up");
        }
      } else if (url.pathname.endsWith("/sign-in/email")) {
        request.log.info({ category: "security", event: "auth_sign_in", userId: readUserId(payload), requestId: request.id }, "auth_sign_in");
      }
    }
    return sendAuthResponse(response, payload, reply);
  });

  app.get("/v1/me", { onRequest: app.authenticate }, async (request) => ({
    user: request.currentUser,
  }));
}

declare module "fastify" {
  interface FastifyInstance {
    auth: AuthProvider;
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    config: import("../../config.js").AppConfig;
  }

  interface FastifyRequest {
    currentUser: CurrentUser | null;
  }
}
