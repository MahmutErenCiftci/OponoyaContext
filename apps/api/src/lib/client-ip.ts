import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { FastifyInstance } from "fastify";

/** Header the web proxy uses to assert the end-user address, and the only IP header Better Auth reads. */
export const clientIpHeader = "x-devcontext-client-ip";
export const proxySecretHeader = "x-devcontext-proxy-secret";

function sameSecret(presented: string, expected: string) {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolves `request.clientIp` before anything else runs. The web proxy's
 * assertion is accepted only with the shared secret; any other caller gets
 * its socket address (or the trusted proxy's view of it). The assertion
 * header is then rewritten to the resolved value and the secret removed, so
 * Better Auth's limiter and every later hook see one sanitized address and
 * a client can never choose its own rate-limit bucket.
 */
export function registerClientIp(app: FastifyInstance, proxySecret: string | undefined) {
  app.decorateRequest("clientIp", "");
  app.addHook("onRequest", async (request) => {
    const presented = single(request.headers[proxySecretHeader]);
    const claimed = single(request.headers[clientIpHeader])?.trim();
    let clientIp = request.ip;
    if (proxySecret && presented && sameSecret(presented, proxySecret) && claimed && isIP(claimed)) clientIp = claimed;
    delete request.headers[proxySecretHeader];
    request.headers[clientIpHeader] = clientIp;
    request.clientIp = clientIp;
  });
}

declare module "fastify" {
  interface FastifyRequest {
    /** End-user address for rate limiting; never logged. */
    clientIp: string;
  }
}
