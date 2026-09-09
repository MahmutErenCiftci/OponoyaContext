import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config.js";

const valid = { DATABASE_URL: "postgresql://user:password@localhost:5432/devcontext" };

describe("environment configuration", () => {
  it("sets safe development defaults and accepts explicit values", () => {
    expect(readConfig(valid)).toMatchObject({
      API_PORT: 4000,
      API_HOST: "127.0.0.1",
      BETTER_AUTH_URL: "http://localhost:4000",
    });
    expect(readConfig({
      ...valid,
      API_PORT: "4567",
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
      BETTER_AUTH_URL: "https://api.example.com",
      CORS_ORIGIN: "https://app.example.com",
    }).API_PORT).toBe(4567);
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
  it("requires HTTPS origins, a trusted-proxy flag and a log level with safe defaults", () => {
    const production = { ...valid, NODE_ENV: "production", BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough" };
    expect(() => readConfig({ ...production, BETTER_AUTH_URL: "http://api.example.com", CORS_ORIGIN: "https://app.example.com" })).toThrow("BETTER_AUTH_URL");
    expect(() => readConfig({ ...production, BETTER_AUTH_URL: "https://api.example.com", CORS_ORIGIN: "http://app.example.com" })).toThrow("CORS_ORIGIN");
    const secure = readConfig({ ...production, BETTER_AUTH_URL: "https://api.example.com", CORS_ORIGIN: "https://app.example.com", TRUST_PROXY: "true" });
    expect(secure).toMatchObject({ TRUST_PROXY: true, LOG_LEVEL: "info" });
    expect(readConfig(valid)).toMatchObject({ TRUST_PROXY: false, LOG_LEVEL: "debug" });
    expect(readConfig({ ...valid, NODE_ENV: "test" }).LOG_LEVEL).toBe("silent");
    expect(readConfig({ ...valid, LOG_LEVEL: "warn", TRUST_PROXY: "1" })).toMatchObject({ TRUST_PROXY: true, LOG_LEVEL: "warn" });
    expect(() => readConfig({ ...valid, TRUST_PROXY: "maybe" })).toThrow("TRUST_PROXY");
    expect(() => readConfig({ ...valid, LOG_LEVEL: "loud" })).toThrow("LOG_LEVEL");
  });

  it("requires an explicit production auth secret", () => {
    expect(() => readConfig({ ...valid, NODE_ENV: "production" })).toThrow("BETTER_AUTH_SECRET");
    expect(readConfig({
      ...valid,
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "a-production-secret-that-is-long-enough",
      BETTER_AUTH_URL: "https://api.example.com",
      CORS_ORIGIN: "https://app.example.com",
    }).BETTER_AUTH_SECRET).toHaveLength(39);
  });
});
