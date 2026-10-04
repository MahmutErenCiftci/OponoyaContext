import { NextResponse, type NextRequest } from "next/server";
import { isEnglishLandingPath, localeCookieName, localeFromAcceptLanguage, localeHeaderName, parseLocale, type Locale } from "./lib/i18n";

/**
 * Interface language of a page request: /en is the English landing and / the
 * Turkish one (someone who chose English is redirected before this); every
 * other page follows the stored choice, then the browser's Accept-Language.
 */
export function requestLocale(request: NextRequest): Locale {
  if (isEnglishLandingPath(request.nextUrl.pathname)) return "en";
  if (request.nextUrl.pathname === "/") return "tr";
  return parseLocale(request.cookies.get(localeCookieName)?.value) ?? localeFromAcceptLanguage(request.headers.get("accept-language"));
}

/**
 * Per-request Content Security Policy. Every page is rendered on demand (the
 * root layout reads the theme cookie), so each response gets a fresh nonce
 * and Next.js stamps it on its own scripts; `'strict-dynamic'` lets those
 * scripts load their chunks. No inline script without the nonce can run.
 * Styles keep `'unsafe-inline'` because React `style` attributes need it.
 */
export function proxy(request: NextRequest) {
  // Someone who chose English and opens the Turkish landing gets the English one; crawlers carry no cookie and keep seeing /.
  if (request.nextUrl.pathname === "/" && parseLocale(request.cookies.get(localeCookieName)?.value) === "en") {
    return NextResponse.redirect(new URL("/en", request.url));
  }
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
  requestHeaders.set(localeHeaderName, requestLocale(request));
  requestHeaders.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", policy);
  if (https) response.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains");
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
