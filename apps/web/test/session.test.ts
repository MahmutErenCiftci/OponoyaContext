import { afterEach, expect, it, vi } from "vitest";
import { getAuditEvents, getCurrentUser } from "../lib/api";
import { readSession, serializeCookies } from "../lib/session";

afterEach(() => vi.unstubAllGlobals());

const user = { id: "00000000-0000-4000-8000-000000000001", email: "dev@example.test", name: "Dev", image: null };

it("tells a signed-out visitor apart from an unreachable API", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ user }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
    .mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
    .mockResolvedValueOnce(Response.json({ user: { id: "not-a-uuid" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await readSession("session=valid")).toEqual({ status: "authenticated", user, cookieHeader: "session=valid" });
  expect(await readSession("session=expired")).toEqual({ status: "anonymous", cookieHeader: "session=expired" });
  expect(await readSession("session=valid")).toEqual({ status: "unavailable", cookieHeader: "session=valid" });
  expect(await readSession("session=valid")).toEqual({ status: "unavailable", cookieHeader: "session=valid" });
  expect(await readSession("session=valid")).toEqual({ status: "unavailable", cookieHeader: "session=valid" });
  expect(fetch).toHaveBeenNthCalledWith(1, expect.any(URL), expect.objectContaining({ headers: { cookie: "session=valid" } }));
  expect(String(fetch.mock.calls[0]?.[0])).toContain("/v1/me");
});

it("keeps getCurrentUser as the simple null-on-anything-else view", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ user })).mockResolvedValueOnce(new Response(null, { status: 503 })));
  expect(await getCurrentUser("session=valid")).toEqual(user);
  expect(await getCurrentUser("session=valid")).toBeNull();
});

it("serializes cookies and reads the audit trail with a bounded limit", async () => {
  expect(serializeCookies([{ name: "a", value: "1" }, { name: "b", value: "2" }])).toBe("a=1; b=2");
  const event = { id: "00000000-0000-4000-8000-000000000090", action: "project.compiled", entityType: "project", entityId: "00000000-0000-4000-8000-000000000030", metadata: { version: 1 }, requestId: "req-1", createdAt: new Date().toISOString() };
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ events: [event] })).mockResolvedValueOnce(new Response(null, { status: 500 }));
  vi.stubGlobal("fetch", fetch);
  expect(await getAuditEvents("session=valid")).toEqual([event]);
  expect(String(fetch.mock.calls[0]?.[0])).toContain("/v1/audit?limit=8");
  expect(await getAuditEvents("session=valid")).toBeNull();
});
