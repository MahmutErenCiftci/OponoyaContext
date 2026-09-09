import { afterEach, expect, it, vi } from "vitest";
import { getCurrentUser, getProject, getProjectList, getWorkspaceStatus } from "../lib/api";

afterEach(() => vi.unstubAllGlobals());
it("checks the API response against the shared contract", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true, service: "devcontext-api" })));
  expect(await getWorkspaceStatus()).toBe("connected");
});
it.each([Response.json({ ok: true, service: "wrong" }), new Response("bad gateway", { status: 502 }), new Response("not json")])("handles invalid or failed responses", async (response) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  expect(await getWorkspaceStatus()).toBe("unavailable");
});
it("handles connection errors and rejects non-HTTP configuration", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
  vi.stubGlobal("fetch", fetch);
  expect(await getWorkspaceStatus()).toBe("unavailable");
  fetch.mockClear();
  expect(await getWorkspaceStatus("file:///private")).toBe("unavailable");
  expect(fetch).not.toHaveBeenCalled();
});
it("resolves the authenticated user and treats invalid sessions as anonymous", async () => {
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "dev@example.test", name: "Dev", image: null };
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ user })).mockResolvedValueOnce(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetch);
  expect(await getCurrentUser("session=valid")).toEqual(user);
  expect(await getCurrentUser("session=expired")).toBeNull();
  expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ headers: { cookie: "session=valid" } }));
});
it("reads Projects on behalf of the session and treats missing or malformed ones as absent", async () => {
  const now = new Date().toISOString();
  const project = {
    id: "00000000-0000-4000-8000-000000000030", name: "Atlas Finance", slug: "atlas-finance-00000000", description: null,
    productType: "SaaS", stage: "mvp", status: "active", platforms: ["web"], priorities: [], rules: [], recipe: null, profiles: [], resources: [], createdAt: now, updatedAt: now,
  };
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ projects: [project], total: 1 }))
    .mockResolvedValueOnce(Response.json({ project }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json({ project: { id: project.id } }));
  vi.stubGlobal("fetch", fetch);
  expect(await getProjectList("session=valid", new URLSearchParams({ status: "active", limit: "3" }))).toEqual({ projects: [project], total: 1 });
  expect(String(fetch.mock.calls[0]?.[0])).toContain("/v1/projects?status=active&limit=3");
  expect(await getProject("session=valid", project.id)).toEqual(project);
  expect(String(fetch.mock.calls[1]?.[0])).toContain(`/v1/projects/${project.id}`);
  expect(await getProject("session=valid", project.id)).toBeNull();
  expect(await getProject("session=valid", project.id)).toBeNull();
});
