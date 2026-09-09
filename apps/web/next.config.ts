import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
/** Monorepo root, so the standalone output traces workspace packages and the lockfile-pinned dependencies. */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Baseline browser hardening. Next.js injects inline hydration scripts and
 * inline styles, so those stay allowed; every other origin is closed except
 * the Google Fonts stylesheet already used by the design. Development adds
 * eval and websockets for Fast Refresh only.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self'${production ? "" : " ws: wss:"}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server for the container image (apps/web/Dockerfile copies .next/standalone + static + public).
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
