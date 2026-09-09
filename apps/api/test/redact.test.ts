import { describe, expect, it } from "vitest";
import { redactText, summarizeError } from "../src/lib/redact.js";

describe("log redaction", () => {
  it("masks connection strings, credentials, tokens, e-mail addresses and key details", () => {
    const text = [
      "connect to postgresql://devcontext:hunter2@db.internal:5432/devcontext failed",
      "header authorization: Bearer abcdefgh.ijklmnop.qrstuvwx",
      "password=super-secret token: 'abc123' api_key=\"k-1\" cookie=devcontext.session_token=xyz",
      "user owner@example.test tried 0123456789abcdef0123456789abcdef",
      'duplicate key value violates unique constraint "x" Key (email)=(owner@example.test)',
      "https://example.com/private?token=1",
    ].join(" | ");
    const redacted = redactText(text);
    for (const secret of ["hunter2", "db.internal", "abcdefgh.ijklmnop", "super-secret", "abc123", "k-1", "session_token=xyz", "owner@example.test", "0123456789abcdef", "/private?token=1"]) {
      expect(redacted).not.toContain(secret);
    }
    expect(redacted).toContain("postgresql://[redacted]");
    expect(redacted).toContain("authorization: [redacted]");
    expect(redactText("Authorization header Bearer abcdefgh.ijklmnop.qrstuvwx sent")).toBe("Authorization header Bearer [redacted] sent");
    expect(redacted).toContain("password=[redacted]");
    expect(redacted).toContain("[email]");
    expect(redacted).toContain("Key ([redacted])");
    expect(redacted).toContain("[hex]");
  });

  it("bounds the length and keeps ordinary text readable", () => {
    expect(redactText("Project not found")).toBe("Project not found");
    expect(redactText("x".repeat(1_000), 100)).toHaveLength(101);
  });

  it("summarizes errors with class, driver code, constraint, fingerprint and frames but no raw message", () => {
    const error = Object.assign(new Error("password=secret SELECT private_data"), { code: "23505", constraint: "resources_owner_slug_unique" });
    const summary = summarizeError(error);
    expect(summary).toMatchObject({ name: "Error", code: "23505", constraint: "resources_owner_slug_unique" });
    expect(summary.fingerprint).toMatch(/^[a-f0-9]{12}$/);
    expect(summary.frames.length).toBeGreaterThan(0);
    expect(summary.frames.every((frame) => frame.startsWith("at "))).toBe(true);
    expect(summary.message).toBe("password=[redacted] SELECT private_data");
    expect(summary.frames.join("\n")).not.toContain("secret");
    expect(summarizeError("plain failure")).toMatchObject({ name: "string", message: "plain failure", code: null, frames: [] });
    expect(summarizeError(new TypeError("boom")).fingerprint).not.toBe(summary.fingerprint);
  });
});
