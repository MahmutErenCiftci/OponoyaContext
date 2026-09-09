import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "../../../lib/api";

export async function GET(request: NextRequest) {
  const target = new URL("/v1/global-decisions", getApiBaseUrl());
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  try {
    const upstream = await fetch(target, { method: "GET", headers, redirect: "manual" });
    return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
  } catch {
    return Response.json({ error: { message: "Decision service is unavailable." } }, { status: 502 });
  }
}
