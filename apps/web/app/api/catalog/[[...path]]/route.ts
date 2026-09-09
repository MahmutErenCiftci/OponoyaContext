import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "../../../../lib/api";

type RouteContext = { params: Promise<{ path?: string[] }> };

/** Technology catalog reads and "add to Library" actions live under /v1/catalog on the API. */
async function proxyCatalogRequest(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const target = new URL(`/v1/catalog${suffix}`, getApiBaseUrl());
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

export const GET = proxyCatalogRequest;
export const POST = proxyCatalogRequest;
