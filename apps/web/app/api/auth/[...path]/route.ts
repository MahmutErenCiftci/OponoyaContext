import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "../../../../lib/api";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyAuthRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const target = new URL(`/api/auth/${path.map(encodeURIComponent).join("/")}`, getApiBaseUrl());
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (!["GET", "HEAD"].includes(request.method)) init.body = await request.arrayBuffer();

  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("set-cookie");
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append("set-cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ message: "Authentication service is unavailable." }, { status: 502 });
  }
}

export const GET = proxyAuthRequest;
export const POST = proxyAuthRequest;
