import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content Security Policy. Every page is rendered on demand (the
 * root layout reads the theme cookie), so each response gets a fresh nonce
 * and Next.js stamps it on its own scripts; `'strict-dynamic'` lets those
 * scripts load their chunks. No inline script without the nonce can run.
 * Styles keep `'unsafe-inline'` because React `style` attributes need it.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const production = process.env.NODE_ENV === "production";
  const https = process.env.SITE_URL?.startsWith("https://") ?? false;
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self'${production ? "" : " ws: wss:"}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API proxies answer JSON, and static assets carry their own headers.
      source: "/((?!api/|_next/static|_next/image|logos/|design/|icon|apple-icon|opengraph-image|manifest.webmanifest|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
