import { describe, expect, it } from "vitest";
import { createErrorReporter, parseSentryDsn } from "../src/lib/error-reporter.js";
import { summarizeError } from "../src/lib/redact.js";

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

function recorder(status = 200) {
  const sent: Sent[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(null, { status });
  }) as typeof fetch;
  return { sent, fetchImpl };
}

function logger() {
  const warnings: Array<Record<string, unknown>> = [];
  return { warnings, warn(payload: Record<string, unknown>) { warnings.push(payload); } };
}

const secretError = Object.assign(new Error("duplicate key value (email)=(owner@example.test) password=hunter2"), { code: "23505", constraint: "users_email_unique" });
const base = { environment: "staging", release: "2026.09.26", service: "devcontext-api" };

describe("error reporter", () => {
  it("parses Sentry DSNs into the store endpoint and rejects malformed ones", () => {
    expect(parseSentryDsn("https://publickey@o1.ingest.example.test/42")).toEqual({ endpoint: "https://o1.ingest.example.test/api/42/store/", key: "publickey" });
    expect(parseSentryDsn("https://o1.ingest.example.test/42")).toBeNull();
    expect(parseSentryDsn("https://key@o1.ingest.example.test/")).toBeNull();
    expect(parseSentryDsn("not a url")).toBeNull();
  });

  it("does nothing when no target is configured", async () => {
    const { sent, fetchImpl } = recorder();
    const reporter = createErrorReporter({ ...base, fetchImpl }, logger());
    expect(reporter).toMatchObject({ enabled: false, target: "none" });
    await reporter.report(summarizeError(secretError), { category: "unexpected_error" });
    expect(sent).toEqual([]);
  });

  it("warns about a malformed DSN and stays off", () => {
    const log = logger();
    expect(createErrorReporter({ ...base, sentryDsn: "https://example.test" }, log).target).toBe("none");
    expect(log.warnings).toHaveLength(1);
  });

  it("posts a content-free JSON report to the webhook with the bearer token", async () => {
    const { sent, fetchImpl } = recorder();
    const reporter = createErrorReporter({ ...base, url: "https://hooks.example.test/errors", token: "hook-token", fetchImpl, now: () => Date.parse("2026-09-26T10:00:00Z") }, logger());
    await reporter.report(summarizeError(secretError), { category: "unexpected_error", requestId: "req-1", route: "/v1/projects", statusCode: 500 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("https://hooks.example.test/errors");
    expect(sent[0]!.headers).toMatchObject({ authorization: "Bearer hook-token", "content-type": "application/json" });
    expect(sent[0]!.body).toMatchObject({
      service: "devcontext-api", environment: "staging", release: "2026.09.26", timestamp: "2026-09-26T10:00:00.000Z",
      category: "unexpected_error", name: "Error", code: "23505", constraint: "users_email_unique", requestId: "req-1", route: "/v1/projects", statusCode: 500,
    });
    const text = JSON.stringify(sent[0]!.body);
    expect(text).not.toContain("owner@example.test");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("duplicate key");
    expect(sent[0]!.body).not.toHaveProperty("message");
  });

  it("speaks the Sentry store protocol without an SDK", async () => {
    const { sent, fetchImpl } = recorder();
    const reporter = createErrorReporter({ ...base, sentryDsn: "https://publickey@o1.ingest.example.test/42", url: "https://ignored.example.test", fetchImpl }, logger());
    expect(reporter.target).toBe("sentry");
    await reporter.report(summarizeError(secretError), { category: "unexpected_error", route: null });
    expect(sent[0]!.url).toBe("https://o1.ingest.example.test/api/42/store/");
    expect(sent[0]!.headers["x-sentry-auth"]).toBe("Sentry sentry_version=7, sentry_client=devcontext-api/1.0, sentry_key=publickey");
    expect(sent[0]!.body).toMatchObject({ platform: "node", level: "error", environment: "staging", release: "2026.09.26", tags: { route: "unmatched" } });
    expect(sent[0]!.body.exception).toEqual({ values: [expect.objectContaining({ type: "Error", value: "23505" })] });
    expect(JSON.stringify(sent[0]!.body)).not.toContain("hunter2");
  });

  it("deduplicates a fingerprint for ten seconds and caps reports per minute", async () => {
    let clock = 0;
    const { sent, fetchImpl } = recorder();
    const reporter = createErrorReporter({ ...base, url: "https://hooks.example.test/errors", fetchImpl, perMinute: 3, now: () => clock }, logger());
    const same = summarizeError(secretError);
    await reporter.report(same, { category: "a" });
    await reporter.report(same, { category: "a" });
    expect(sent).toHaveLength(1);
    clock = 10_000;
    await reporter.report(same, { category: "a" });
    expect(sent).toHaveLength(2);
    await reporter.report({ ...same, fingerprint: "other-1" }, { category: "a" });
    await reporter.report({ ...same, fingerprint: "other-2" }, { category: "a" });
    expect(sent).toHaveLength(3);
    clock = 70_000;
    await reporter.report({ ...same, fingerprint: "other-3" }, { category: "a" });
    expect(sent).toHaveLength(4);
  });

  it("never throws when the transport fails and warns at most once a minute", async () => {
    let clock = 0;
    const log = logger();
    const failing = (async () => { throw new Error("connect ECONNREFUSED with secret-token"); }) as typeof fetch;
    const reporter = createErrorReporter({ ...base, url: "https://hooks.example.test/errors", fetchImpl: failing, now: () => clock }, log);
    await expect(reporter.report({ ...summarizeError(secretError), fingerprint: "f1" }, { category: "a" })).resolves.toBeUndefined();
    clock = 20_000;
    await reporter.report({ ...summarizeError(secretError), fingerprint: "f2" }, { category: "a" });
    expect(log.warnings).toHaveLength(1);
    const { fetchImpl } = recorder(500);
    const rejecting = createErrorReporter({ ...base, url: "https://hooks.example.test/errors", fetchImpl, now: () => clock }, log);
    await rejecting.report(summarizeError(secretError), { category: "a" });
    expect(log.warnings).toHaveLength(2);
    expect(log.warnings[1]).toMatchObject({ category: "monitoring", target: "webhook", reason: "status 500" });
  });
});
