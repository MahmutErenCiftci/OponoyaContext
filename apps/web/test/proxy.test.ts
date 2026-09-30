import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIpFrom } from "../lib/client-ip";
import { contextStatusFrom } from "../lib/context-status";
import { downstreamHeaders, proxyToApi, upstreamHeaders } from "../lib/proxy";
import { siteUrl } from "../lib/site";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest(url, { method: init.method ?? "GET", headers: init.headers ?? {}, ...(init.body !== undefined ? { body: init.body } : {}) });
}

describe("client address", () => {
  it("reads X-Forwarded-For from the right, skipping only trusted hops", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.2" });
    expect(clientIpFrom(headers, { TRUSTED_PROXY_HOPS: "1" })).toBe("10.0.0.2");
    expect(clientIpFrom(headers, { TRUSTED_PROXY_HOPS: "2" })).toBe("203.0.113.9");
    expect(clientIpFrom(headers, {})).toBe("10.0.0.2");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "not-an-ip" }), {})).toBeNull();
    expect(clientIpFrom(new Headers(), {})).toBeNull();
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "[2001:db8::1]" }), {})).toBe("2001:db8::1");
  });

  it("prefers a dedicated edge header when one is configured", () => {
    const headers = new Headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "6.6.6.6" });
    expect(clientIpFrom(headers, { CLIENT_IP_HEADER: "CF-Connecting-IP" })).toBe("198.51.100.7");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6" }), { CLIENT_IP_HEADER: "cf-connecting-ip" })).toBeNull();
  });
});

describe("same-origin API proxy", () => {
  it("forwards only allow-listed headers and asserts the client address with the shared secret", () => {
    vi.stubEnv("WEB_PROXY_SECRET", "a-web-proxy-secret-that-is-long-enough-too");
    const headers = upstreamHeaders(request("http://localhost:3000/api/projects", {
      headers: {
        cookie: "devcontext.session_token=abc", origin: "http://localhost:3000", "content-type": "application/json",
        "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-real-ip": "6.6.6.6", forwarded: "for=6.6.6.6", "x-devcontext-client-ip": "6.6.6.6",
        host: "evil.example", connection: "keep-alive", "sec-fetch-site": "same-origin",
      },
    }));
    expect(headers.get("cookie")).toBe("devcontext.session_token=abc");
    expect(headers.get("origin")).toBe("http://localhost:3000");
    expect(headers.get("sec-fetch-site")).toBe("same-origin");
    expect(headers.get("x-devcontext-client-ip")).toBe("203.0.113.9");
    expect(headers.get("x-devcontext-proxy-secret")).toBe("a-web-proxy-secret-that-is-long-enough-too");
    for (const dropped of ["x-forwarded-for", "x-real-ip", "forwarded", "host", "connection"]) expect(headers.get(dropped)).toBeNull();
  });

  it("never asserts an address without the secret", () => {
    vi.stubEnv("WEB_PROXY_SECRET", "");
    const headers = upstreamHeaders(request("http://localhost:3000/api/projects", { headers: { "x-forwarded-for": "203.0.113.9", "x-devcontext-client-ip": "6.6.6.6" } }));
    expect(headers.get("x-devcontext-client-ip")).toBeNull();
    expect(headers.get("x-devcontext-proxy-secret")).toBeNull();
  });

  it("drops hop-by-hop and encoding headers from the answer but keeps every cookie", () => {
    const upstream = new Response("{}", { headers: [["content-type", "application/json"], ["content-encoding", "gzip"], ["connection", "keep-alive"], ["x-request-id", "req-1"], ["set-cookie", "a=1; Path=/"], ["set-cookie", "b=2; Path=/"]] });
    const headers = downstreamHeaders(upstream);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-request-id")).toBe("req-1");
    expect(headers.get("content-encoding")).toBeNull();
    expect(headers.get("connection")).toBeNull();
    expect(headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });

  it("refuses dot segments, disallowed paths and oversized bodies before calling the API", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const options = { prefix: "/v1/projects", unavailableMessage: "down" };
    expect((await proxyToApi(request("http://localhost:3000/api/projects/x"), [".."], options)).status).toBe(404);
    expect((await proxyToApi(request("http://localhost:3000/api/projects/x"), ["a", ""], options)).status).toBe(404);
    expect((await proxyToApi(request("http://localhost:3000/api/billing/webhook", { method: "POST", body: "{}" }), ["webhook"], { ...options, allow: (_method, segments) => segments[0] !== "webhook" })).status).toBe(404);
    const oversized = await proxyToApi(request("http://localhost:3000/api/projects", { method: "POST", body: "x".repeat(2_048) }), [], { ...options, maxBodyBytes: 1_024 });
    expect(oversized.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("re-encodes segments under the fixed prefix and reports an unreachable API as 502", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ ok: true })).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetch);
    const options = { prefix: "/v1/projects", unavailableMessage: "Project service is unavailable." };
    const ok = await proxyToApi(request("http://localhost:3000/api/projects/a%2Fb?view=x"), ["a/b"], options);
    expect(ok.status).toBe(200);
    const target = fetch.mock.calls[0]![0] as URL;
    expect(target.pathname).toBe("/v1/projects/a%2Fb");
    expect(target.search).toBe("?view=x");
    const down = await proxyToApi(request("http://localhost:3000/api/projects"), [], options);
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ error: { message: "Project service is unavailable." } });
  });
});

describe("site origin and context freshness", () => {
  it("accepts only a bare HTTP(S) origin", () => {
    expect(siteUrl("https://app.example.com")?.origin).toBe("https://app.example.com");
    expect(siteUrl("https://app.example.com/")?.origin).toBe("https://app.example.com");
    expect(siteUrl("https://app.example.com/path")).toBeNull();
    expect(siteUrl("javascript:alert(1)")).toBeNull();
    expect(siteUrl(undefined)).toBeNull();
  });

  it("maps the light batch status like the full state", () => {
    expect(contextStatusFrom(undefined)).toEqual({ kind: "none", version: null, createdAt: null, warnings: 0 });
    expect(contextStatusFrom({ projectId: "p", stale: true, draftWarningCount: 2, latest: null })).toEqual({ kind: "none", version: null, createdAt: null, warnings: 2 });
    expect(contextStatusFrom({ projectId: "p", stale: false, draftWarningCount: 0, latest: { version: 3, createdAt: "2026-09-26T00:00:00.000Z", warningCount: 1 } }))
      .toEqual({ kind: "fresh", version: 3, createdAt: "2026-09-26T00:00:00.000Z", warnings: 1 });
  });
});
