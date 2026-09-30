import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Monorepo root, so the standalone output traces workspace packages and the lockfile-pinned dependencies. */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Baseline browser hardening for every response. The page Content Security
 * Policy is set per request with a nonce in proxy.ts; responses the proxy
 * does not handle (API proxies, static files) get a policy that allows
 * nothing active. HSTS is sent when the public origin is HTTPS (`SITE_URL`).
 */
const https = process.env.SITE_URL?.startsWith("https://") ?? false;

export const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

/** Brand SVGs are served from this origin: opened directly they must not be able to run anything. */
const logoHeaders = [
  { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
  { key: "Cache-Control", value: "public, max-age=86400" },
];

/** Signed-in pages are never indexed, whatever a crawler finds. */
const privateHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server for the container image (apps/web/Dockerfile copies .next/standalone + static + public).
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/logos/:path*", headers: logoHeaders },
      { source: "/workspace/:path*", headers: privateHeaders },
      { source: "/workspace", headers: privateHeaders },
      { source: "/billing/:path*", headers: privateHeaders },
      { source: "/api/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" }] },
    ];
  },
  async rewrites() {
    // Browsers and crawlers still ask for /favicon.ico; answer with the generated icon.
    return [{ source: "/favicon.ico", destination: "/icon/favicon" }];
  },
};

export default nextConfig;
