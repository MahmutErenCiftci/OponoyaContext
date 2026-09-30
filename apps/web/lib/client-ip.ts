import { isIP } from "node:net";

/**
 * End-user address as seen by the web tier, used only to key the API's
 * anonymous rate limits. It is derived from infrastructure the operator
 * trusts, never from a header the browser can set:
 *
 * - `CLIENT_IP_HEADER` names a single-value header the edge overwrites on
 *   every request (for example `cf-connecting-ip` or `fly-client-ip`);
 * - otherwise `X-Forwarded-For` is read from the right: `TRUSTED_PROXY_HOPS`
 *   (default 1) is the number of proxies in front of the web server that
 *   append to it. Entries further left were written by the client.
 *
 * Returns null when no trustworthy address is available.
 */
export function clientIpFrom(headers: Headers, env: Record<string, string | undefined> = process.env): string | null {
  const dedicated = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (dedicated) {
    const value = headers.get(dedicated)?.trim() ?? "";
    return isIP(value) ? value : null;
  }
  const hops = Math.max(1, Math.min(10, Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1));
  const chain = (headers.get("x-forwarded-for") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  const candidate = chain[chain.length - hops];
  if (!candidate) return null;
  const unwrapped = candidate.startsWith("[") && candidate.includes("]") ? candidate.slice(1, candidate.indexOf("]")) : candidate;
  return isIP(unwrapped) ? unwrapped : null;
}
