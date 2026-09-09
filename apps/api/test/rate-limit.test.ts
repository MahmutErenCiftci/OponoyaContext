import { describe, expect, it } from "vitest";
import { createRateLimiter, defaultRateLimitPolicy, expensiveRoutes, ruleForRoute } from "../src/lib/rate-limit.js";

describe("process-local rate limiter", () => {
  const rule = { name: "test", max: 3, windowMs: 60_000 };

  it("allows up to the limit inside a window and blocks afterwards with a reset hint", () => {
    let now = 1_000_000;
    const limiter = createRateLimiter(() => now);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const verdict = limiter.consume(rule, "user:a");
      expect(verdict.allowed).toBe(true);
      expect(verdict.remaining).toBe(2 - attempt);
    }
    const blocked = limiter.consume(rule, "user:a");
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, limit: 3, resetAt: 1_060_000, retryAfterSeconds: 60 });
    now += 30_000;
    expect(limiter.consume(rule, "user:a")).toMatchObject({ allowed: false, retryAfterSeconds: 30 });
    now += 30_000;
    expect(limiter.consume(rule, "user:a")).toMatchObject({ allowed: true, remaining: 2, resetAt: 1_120_000 });
  });

  it("keeps keys and rules in separate buckets and sweeps expired ones", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    limiter.consume(rule, "user:a");
    limiter.consume(rule, "user:a");
    limiter.consume(rule, "user:a");
    expect(limiter.consume(rule, "user:a").allowed).toBe(false);
    expect(limiter.consume(rule, "user:b").allowed).toBe(true);
    expect(limiter.consume({ ...rule, name: "other" }, "user:a").allowed).toBe(true);
    expect(limiter.size()).toBe(3);
    now = 60_000;
    limiter.sweep();
    expect(limiter.size()).toBe(0);
  });

  it("maps routes to the policy: expensive endpoints, reads and mutations", () => {
    for (const route of expensiveRoutes) {
      const [method, pattern] = route.split(" ");
      expect(ruleForRoute(defaultRateLimitPolicy, method!, pattern)).toBe(defaultRateLimitPolicy.expensive);
    }
    expect(ruleForRoute(defaultRateLimitPolicy, "GET", "/v1/projects/:id/compile")).toBe(defaultRateLimitPolicy.read);
    expect(ruleForRoute(defaultRateLimitPolicy, "GET", "/v1/resources")).toBe(defaultRateLimitPolicy.read);
    expect(ruleForRoute(defaultRateLimitPolicy, "HEAD", "/v1/resources")).toBe(defaultRateLimitPolicy.read);
    expect(ruleForRoute(defaultRateLimitPolicy, "PATCH", "/v1/resources/:id")).toBe(defaultRateLimitPolicy.mutate);
    expect(ruleForRoute(defaultRateLimitPolicy, "DELETE", undefined)).toBe(defaultRateLimitPolicy.mutate);
    expect(defaultRateLimitPolicy.expensive.max).toBeLessThan(defaultRateLimitPolicy.mutate.max);
    expect(defaultRateLimitPolicy.auth.max).toBeLessThan(defaultRateLimitPolicy.mutate.max);
  });
});
