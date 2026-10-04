import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "./api";
import { clientIpFrom } from "./client-ip";
import { localeFromAcceptLanguage, localeFromCookieHeader } from "./i18n";

/**
 * The one same-origin proxy from `/api/*` to the Fastify API. Every route
 * handler under `app/api` delegates here so the hardening lives in one place:
 *
 * - only an allow-list of request headers travels upstream; forwarding and
 *   hop-by-hop headers the browser sent are dropped and the end-user address
 *   is asserted with the shared `WEB_PROXY_SECRET` instead;
 * - bodies are read with a byte cap before anything is sent, and the upstream
 *   call stops when the browser goes away or the timeout passes;
 * - path segments are re-encoded and dot segments rejected, so a request can
 *   only reach the API prefix its route handler names;
 * - upstream hop-by-hop and encoding headers are not copied back.
 */

export const defaultMaxBodyBytes = 1_048_576;
export const defaultTimeoutMs = 20_000;

const forwardedRequestHeaders = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "idempotency-key",
  "origin",
  "referer",
  "user-agent",
  // Better Auth's CSRF checks read Fetch Metadata.
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
] as const;

const droppedResponseHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  // fetch() already decoded the body; the length is recomputed by the server.
  "content-encoding",
  "content-length",
  "set-cookie",
]);

export type ProxyOptions = {
  /** API path the route handler owns, e.g. `/v1/resources`. */
  prefix: string;
  /** Message of the 502 answer when the API cannot be reached. */
  unavailableMessage: string;
  /** Body cap; a function lets one prefix allow a larger upload on a single path (the workspace import). */
  maxBodyBytes?: number | ((segments: readonly string[]) => number);
  timeoutMs?: number | ((segments: readonly string[]) => number);
  /** Extra gate on method + path segments (the auth proxy allow-lists Better Auth endpoints). */
  allow?: (method: string, segments: readonly string[]) => boolean;
};

/** The visitor's interface language, for the few messages the proxy writes itself. */
function requestLanguage(request: NextRequest) {
  return localeFromCookieHeader(request.headers.get("cookie")) ?? localeFromAcceptLanguage(request.headers.get("accept-language"));
}

/** Route handlers name their service in Turkish; an English visitor gets the generic English line instead. */
function unavailableText(request: NextRequest, options: ProxyOptions) {
  return requestLanguage(request) === "en" ? "The service cannot be reached right now. Try again shortly." : options.unavailableMessage;
}

function notFoundText(request: NextRequest) {
  return requestLanguage(request) === "en" ? "Not found." : "Bulunamadı.";
}

function tooLargeText(request: NextRequest) {
  return requestLanguage(request) === "en" ? "The content you sent is too large." : "Gönderilen içerik çok büyük.";
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: { message } }, { status, headers: { "cache-control": "no-store" } });
}

/** Reads at most `limit` bytes; null when the body is larger. */
async function readBoundedBody(request: NextRequest, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

let warnedMissingSecret = false;

export function upstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const secret = process.env.WEB_PROXY_SECRET;
  if (!secret && process.env.NODE_ENV === "production" && !warnedMissingSecret) {
    // Not fatal (CI previews run without it), but in production every anonymous sign-in would share one rate-limit bucket.
    warnedMissingSecret = true;
    console.warn(JSON.stringify({ level: "warn", category: "security", event: "web_proxy_secret_missing", message: "WEB_PROXY_SECRET is not set; the API rate-limits sign-in per web server instead of per client" }));
  }
  const clientIp = clientIpFrom(request.headers);
  if (secret && clientIp) {
    headers.set("x-devcontext-proxy-secret", secret);
    headers.set("x-devcontext-client-ip", clientIp);
  }
  return headers;
}

export function downstreamHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!droppedResponseHeaders.has(name.toLowerCase())) headers.set(name, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return headers;
}

export async function proxyToApi(request: NextRequest, segments: readonly string[], options: ProxyOptions): Promise<Response> {
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return errorResponse(404, notFoundText(request));
  if (options.allow && !options.allow(request.method, segments)) return errorResponse(404, notFoundText(request));

  const suffix = segments.length > 0 ? `/${segments.map(encodeURIComponent).join("/")}` : "";
  let target: URL;
  try {
    target = new URL(`${options.prefix}${suffix}`, getApiBaseUrl());
  } catch {
    return errorResponse(502, unavailableText(request, options));
  }
  target.search = request.nextUrl.search;

  const init: RequestInit = { method: request.method, headers: upstreamHeaders(request), redirect: "manual", cache: "no-store" };
  if (!["GET", "HEAD"].includes(request.method)) {
    const limit = typeof options.maxBodyBytes === "function" ? options.maxBodyBytes(segments) : options.maxBodyBytes ?? defaultMaxBodyBytes;
    const body = await readBoundedBody(request, limit);
    if (body === null) return errorResponse(413, tooLargeText(request));
    init.body = body;
  }

  const timeout = AbortSignal.timeout(typeof options.timeoutMs === "function" ? options.timeoutMs(segments) : options.timeoutMs ?? defaultTimeoutMs);
  init.signal = AbortSignal.any([request.signal, timeout]);
  try {
    const upstream = await fetch(target, init);
    return new Response(upstream.body, { status: upstream.status, headers: downstreamHeaders(upstream) });
  } catch {
    if (timeout.aborted) return errorResponse(504, unavailableText(request, options));
    return errorResponse(502, unavailableText(request, options));
  }
}

/** Standard route-handler pair for a catch-all segment: `export const { GET, POST } = apiProxy({...})`. */
export function apiProxy(options: ProxyOptions) {
  return async (request: NextRequest, context: { params: Promise<{ path?: string[] }> }) => {
    const { path = [] } = await context.params;
    return proxyToApi(request, path, options);
  };
}
