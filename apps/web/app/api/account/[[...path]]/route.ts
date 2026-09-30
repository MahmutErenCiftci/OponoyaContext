import { apiProxy } from "../../../../lib/proxy";

/** Account summary, structured export and deletion live under /v1/account on the API (Handoff 11). */
const proxy = apiProxy({
  prefix: "/v1/account",
  unavailableMessage: "Hesap hizmetine şu an ulaşılamıyor.",
  // The structured export can be large; deletion revokes billing at the provider first.
  timeoutMs: 60_000,
});

export const GET = proxy;
export const PUT = proxy;
export const DELETE = proxy;
