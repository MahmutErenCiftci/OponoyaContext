import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "../../../../lib/api";

type RouteContext = { params: Promise<{ path?: string[] }> };

/**
 * Plan summary, checkout/portal redirects, reconciliation and the test-mode
 * provider controls live under /v1/billing on the API. The provider webhook
 * is not proxied: providers call the API directly.
 */
async function proxyBillingRequest(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  if (path[0] === "webhook") return Response.json({ error: { message: "Not found." } }, { status: 404 });
  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const target = new URL(`/v1/billing${suffix}`, getApiBaseUrl());
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) init.body = await request.arrayBuffer();
  try {
    const upstream = await fetch(target, init);
    return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
  } catch {
    return Response.json({ error: { message: "Workspace service is unavailable." } }, { status: 502 });
  }
}

export const GET = proxyBillingRequest;
export const POST = proxyBillingRequest;
