import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * One structured line per request plus security/product markers.
 *
 * Nothing here logs URLs with query strings, bodies, headers or user text:
 * the route pattern, status, duration, request id and user id are enough to
 * correlate a report with a session. Response headers make the request id
 * visible to clients and keep private JSON out of shared caches.
 */
export function registerObservability(app: FastifyInstance) {
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "no-store");
    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    const statusCode = reply.statusCode;
    const entry = {
      category: "http",
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url ?? "unmatched",
      statusCode,
      durationMs: Math.round(reply.elapsedTime),
      userId: request.currentUser?.id ?? null,
      ...(request.rateLimitRule ? { rateLimitRule: request.rateLimitRule } : {}),
    };
    const event = securityEvent(request, statusCode);
    if (event) {
      request.log.warn({ ...entry, category: "security", event }, event);
    } else if (statusCode >= 500) {
      request.log.error(entry, "request failed");
    } else {
      request.log.info(entry, "request");
    }
  });
}

function securityEvent(request: FastifyRequest, statusCode: number): string | null {
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 403 && request.originRejected) return "origin_rejected";
  if (request.routeOptions.url === "/api/auth/*" && statusCode >= 400) return "auth_rejected";
  if (statusCode === 401) return "auth_required";
  if (statusCode === 403) return "forbidden";
  if (statusCode === 413) return "payload_too_large";
  return null;
}

/**
 * Browser mutations always carry an `Origin` header; when it is present it
 * must match the web application. Server-to-server calls have no origin and
 * are unaffected. Complements SameSite cookies as CSRF defence in depth.
 */
export function registerOriginGuard(app: FastifyInstance, allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);
  app.addHook("onRequest", async (request) => {
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
    const origin = request.headers.origin;
    if (origin === undefined) return;
    if (!allowed.has(origin)) {
      request.originRejected = true;
      throw Object.assign(new Error("Origin is not allowed"), { statusCode: 403 });
    }
  });
}

declare module "fastify" {
  interface FastifyRequest {
    originRejected?: boolean;
    rateLimitRule?: string;
  }
}
