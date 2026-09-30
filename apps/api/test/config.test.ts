import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";

const valid = { DATABASE_URL: "postgresql://user:password@localhost:5432/devcontext" };
const production = {
  ...valid,
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
  BETTER_AUTH_URL: "https://api.example.com",
  CORS_ORIGIN: "https://app.example.com",
  WEB_PROXY_SECRET: "a-web-proxy-secret-that-is-long-enough-too",
};

describe("environment configuration", () => {
  it("sets safe development defaults and accepts explicit values", () => {
    expect(readConfig(valid)).toMatchObject({
      API_PORT: 4000,
      API_HOST: "127.0.0.1",
      BETTER_AUTH_URL: "http://localhost:4000",
      AI_PROVIDER: "none",
      AI_MODEL: "claude-opus-5",
      AI_EFFORT: null,
    });
    expect(readConfig({ ...production, API_PORT: "4567" }).API_PORT).toBe(4567);
  });
  it.each(["", "0", "65536", "1.5", "abc"])("rejects invalid port %s", (API_PORT) => {
    expect(() => readConfig({ ...valid, API_PORT })).toThrow("API_PORT");
  });
  it.each(["https://localhost/db", "postgresql://localhost", "not-a-url"])("rejects invalid database URL %s", (DATABASE_URL) => {
    expect(() => readConfig({ DATABASE_URL })).toThrow("DATABASE_URL");
  });
  it("does not include secret values in validation failures", () => {
    try {
      readConfig({ DATABASE_URL: "secret-value", CORS_ORIGIN: "https://example.com/private-token" });
      expect.fail("Expected invalid environment");
    } catch (error) {
      expect(String(error)).toContain("DATABASE_URL");
      expect(String(error)).not.toContain("secret-value");
      expect(String(error)).not.toContain("private-token");
    }
  });
  it("requires HTTPS origins, a trusted-proxy setting and a log level with safe defaults", () => {
    expect(() => readConfig({ ...production, BETTER_AUTH_URL: "http://api.example.com" })).toThrow("BETTER_AUTH_URL");
    expect(() => readConfig({ ...production, CORS_ORIGIN: "http://app.example.com" })).toThrow("CORS_ORIGIN");
    expect(readConfig({ ...production, TRUST_PROXY: "true" })).toMatchObject({ TRUST_PROXY: "loopback,linklocal,uniquelocal", LOG_LEVEL: "info" });
    expect(readConfig(valid)).toMatchObject({ TRUST_PROXY: false, LOG_LEVEL: "debug" });
    expect(readConfig({ ...valid, NODE_ENV: "test" }).LOG_LEVEL).toBe("silent");
    expect(readConfig({ ...valid, LOG_LEVEL: "warn", TRUST_PROXY: "1" })).toMatchObject({ TRUST_PROXY: "loopback,linklocal,uniquelocal", LOG_LEVEL: "warn" });
    expect(readConfig({ ...valid, TRUST_PROXY: "10.0.0.0/8, 192.0.2.10" }).TRUST_PROXY).toBe("10.0.0.0/8,192.0.2.10");
    expect(readConfig({ ...valid, TRUST_PROXY: "0" }).TRUST_PROXY).toBe(false);
    for (const TRUST_PROXY of ["maybe", "10.0.0.0/8/1", "300.1.1.1", "all"]) expect(() => readConfig({ ...valid, TRUST_PROXY })).toThrow("TRUST_PROXY");
    expect(() => readConfig({ ...valid, LOG_LEVEL: "loud" })).toThrow("LOG_LEVEL");
  });

  it("requires an explicit production auth secret, also when only APP_ENV says production", () => {
    const { BETTER_AUTH_SECRET: _omit, ...withoutSecret } = production;
    void _omit;
    expect(() => readConfig(withoutSecret)).toThrow("BETTER_AUTH_SECRET");
    expect(readConfig(production).BETTER_AUTH_SECRET).toHaveLength(39);
    // Production rules key on either variable: APP_ENV=production on a development build is still production.
    expect(() => readConfig({ ...valid, APP_ENV: "production", WEB_PROXY_SECRET: production.WEB_PROXY_SECRET })).toThrow("BETTER_AUTH_SECRET");
    expect(() => readConfig({ ...valid, APP_ENV: "production", BETTER_AUTH_SECRET: production.BETTER_AUTH_SECRET, WEB_PROXY_SECRET: production.WEB_PROXY_SECRET })).toThrow(/BETTER_AUTH_URL|CORS_ORIGIN/);
    // Preview and staging stacks need their own secret too.
    expect(() => readConfig({ ...valid, APP_ENV: "staging" })).toThrow("BETTER_AUTH_SECRET");
    expect(() => readConfig({ ...valid, APP_ENV: "preview", BETTER_AUTH_SECRET: "devcontext-local-secret-change-before-production" })).toThrow("BETTER_AUTH_SECRET");
  });

  it("refuses documented placeholders, plaintext database connections and HTTP error reporting outside development", () => {
    const placeholder = "replace-with-at-least-32-random-characters";
    expect(() => readConfig({ ...production, BETTER_AUTH_SECRET: placeholder })).toThrow("BETTER_AUTH_SECRET");
    expect(() => readConfig({ ...production, WEB_PROXY_SECRET: placeholder })).toThrow("WEB_PROXY_SECRET");
    // A fresh development checkout may still run with the placeholder.
    expect(readConfig({ ...valid, BETTER_AUTH_SECRET: placeholder }).BETTER_AUTH_SECRET).toBe(placeholder);
    expect(() => readConfig({ ...production, DATABASE_URL: "postgresql://user:password@db.example.com:5432/devcontext" })).toThrow("DATABASE_URL");
    expect(readConfig({ ...production, DATABASE_URL: "postgresql://user:password@db.example.com:5432/devcontext?sslmode=verify-full" }).DATABASE_URL).toContain("verify-full");
    expect(() => readConfig({ ...production, SENTRY_DSN: "http://key@sentry.example.com/1" })).toThrow("SENTRY_DSN");
    expect(() => readConfig({ ...production, ERROR_REPORTING_URL: "http://hooks.example.com/errors" })).toThrow("ERROR_REPORTING_URL");
  });

  it("requires the web proxy secret in production", () => {
    const { WEB_PROXY_SECRET: _omit, ...withoutProxySecret } = production;
    void _omit;
    expect(() => readConfig(withoutProxySecret)).toThrow("WEB_PROXY_SECRET");
    expect(() => readConfig({ ...production, WEB_PROXY_SECRET: "too-short" })).toThrow("WEB_PROXY_SECRET");
  });

  it("keeps AI off by default, needs a key for Claude and never runs the fake provider in production", () => {
    expect(() => readConfig({ ...valid, AI_PROVIDER: "anthropic" })).toThrow("AI_API_KEY");
    const claude = readConfig({ ...valid, AI_PROVIDER: "anthropic", AI_API_KEY: "sk-ant-test-key-not-real-000000", AI_EFFORT: "medium", AI_MODEL: "claude-sonnet-5" });
    expect(claude).toMatchObject({ AI_PROVIDER: "anthropic", AI_EFFORT: "medium", AI_MODEL: "claude-sonnet-5", AI_TIMEOUT_MS: 120_000 });
    expect(readConfig({ ...valid, AI_PROVIDER: "fake" }).AI_PROVIDER).toBe("fake");
    expect(() => readConfig({ ...production, AI_PROVIDER: "fake" })).toThrow("AI_PROVIDER");
    expect(() => readConfig({ ...valid, AI_MODEL: "Claude Opus!" })).toThrow("AI_MODEL");
    expect(() => readConfig({ ...valid, AI_EFFORT: "extreme" })).toThrow("AI_EFFORT");
  });
});
