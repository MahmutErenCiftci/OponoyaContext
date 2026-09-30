import type { NextRequest } from "next/server";
import { proxyToApi } from "../../../../lib/proxy";

/**
 * Only the Better Auth endpoints the UI uses are reachable from the browser.
 * Everything else (user deletion, profile updates, session listing) goes
 * through the API's own routes, where the product rules live. The two
 * password-reset endpoints pass here and are refused by the API (404) while
 * no e-mail sender is configured there.
 */
const allowed = new Set(["POST sign-in/email", "POST sign-up/email", "POST sign-out", "POST request-password-reset", "POST reset-password"]);

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, path, {
    prefix: "/api/auth",
    unavailableMessage: "Giriş hizmetine şu an ulaşılamıyor.",
    maxBodyBytes: 16_384,
    allow: (method, segments) => allowed.has(`${method} ${segments.join("/")}`),
  });
}
