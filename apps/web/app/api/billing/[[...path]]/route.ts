import { apiProxy } from "../../../../lib/proxy";

/**
 * Plan summary, checkout/portal redirects, reconciliation and the test-mode
 * provider controls live under /v1/billing on the API. The provider webhook
 * is not proxied: providers call the API directly.
 */
const proxy = apiProxy({
  prefix: "/v1/billing",
  unavailableMessage: "Çalışma alanına şu an ulaşılamıyor.",
  allow: (_method, segments) => segments[0] !== "webhook",
});

export const GET = proxy;
export const POST = proxy;
