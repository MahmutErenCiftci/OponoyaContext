import { apiProxy } from "../../../../lib/proxy";

/** Technology catalog reads and "add to Library" actions live under /v1/catalog on the API. */
const proxy = apiProxy({
  prefix: "/v1/catalog",
  unavailableMessage: "Çalışma alanına şu an ulaşılamıyor.",
  // Adding a whole stack creates several Library resources in one request.
  timeoutMs: 60_000,
});

export const GET = proxy;
export const POST = proxy;
