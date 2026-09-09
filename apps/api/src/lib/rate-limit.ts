import type { FastifyReply } from "fastify";

/**
 * Process-local fixed-window rate limiting.
 *
 * Buckets live in memory, so limits apply per API process. The modular
 * monolith runs as one instance for the V0.3 beta; a multi-instance deployment
 * must share state (Redis-backed store) before the limits mean anything
 * globally, and that is a measured, documented upgrade rather than a default.
 */
export type RateLimitRule = { name: string; max: number; windowMs: number };

export type RateLimitPolicy = {
  /** Anonymous auth traffic (sign-in, sign-up, sign-out) keyed by client IP. */
  auth: RateLimitRule;
  /** Authenticated reads keyed by user. */
  read: RateLimitRule;
  /** Authenticated mutations keyed by user. */
  mutate: RateLimitRule;
  /** Compile, export, clone and save-as-profile keyed by user. */
  expensive: RateLimitRule;
};

export const defaultRateLimitPolicy: RateLimitPolicy = {
  auth: { name: "auth", max: 30, windowMs: 60_000 },
  read: { name: "read", max: 600, windowMs: 60_000 },
  mutate: { name: "mutate", max: 240, windowMs: 60_000 },
  expensive: { name: "expensive", max: 60, windowMs: 60_000 },
};

/** Route patterns (method + Fastify route) whose work is disproportionate to their payload. */
export const expensiveRoutes = new Set([
  "POST /v1/projects/:id/compile",
  "POST /v1/projects/:id/exports",
  "GET /v1/projects/:id/context/bundle",
  "POST /v1/projects/:id/clone",
  "POST /v1/projects/:id/save-as-profile",
  "POST /v1/projects/:id/save-as-recipe",
  "POST /v1/workspace/samples",
  "DELETE /v1/workspace/samples",
  "GET /v1/workspace/export",
  "POST /v1/workspace/import",
  "POST /v1/catalog/stacks/:slug/library",
  "POST /v1/catalog/stacks/:slug/profile",
]);

export function ruleForRoute(policy: RateLimitPolicy, method: string, route: string | undefined): RateLimitRule {
  if (route && expensiveRoutes.has(`${method} ${route}`)) return policy.expensive;
  return method === "GET" || method === "HEAD" ? policy.read : policy.mutate;
}

export type RateLimitVerdict = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds when the window resets. */
  resetAt: number;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  consume(rule: RateLimitRule, key: string): RateLimitVerdict;
  /** Drops expired buckets; also runs opportunistically. */
  sweep(): void;
  size(): number;
};

export function createRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  let operations = 0;

  function sweep() {
    const current = now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(key);
    }
  }

  return {
    consume(rule, key) {
      const current = now();
      operations += 1;
      if (operations % 1_000 === 0 || buckets.size > 50_000) sweep();
      const id = `${rule.name}:${key}`;
      let bucket = buckets.get(id);
      if (!bucket || bucket.resetAt <= current) {
        bucket = { count: 0, resetAt: current + rule.windowMs };
        buckets.set(id, bucket);
      }
      const allowed = bucket.count < rule.max;
      if (allowed) bucket.count += 1;
      return {
        allowed,
        limit: rule.max,
        remaining: Math.max(0, rule.max - bucket.count),
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - current) / 1_000)),
      };
    },
    sweep,
    size: () => buckets.size,
  };
}

export function applyRateLimitHeaders(reply: FastifyReply, verdict: RateLimitVerdict) {
  reply.header("x-ratelimit-limit", String(verdict.limit));
  reply.header("x-ratelimit-remaining", String(verdict.remaining));
  reply.header("x-ratelimit-reset", String(Math.ceil(verdict.resetAt / 1_000)));
  if (!verdict.allowed) reply.header("retry-after", String(verdict.retryAfterSeconds));
}

export function rateLimitedError() {
  return Object.assign(new Error("Too many requests"), { statusCode: 429 });
}
