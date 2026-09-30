import { apiProxy } from "../../../../lib/proxy";

const proxy = apiProxy({
  prefix: "/v1/projects",
  unavailableMessage: "Proje hizmetine şu an ulaşılamıyor.",
  // AI suggestions wait for the provider (API timeout plus one retry); bundles and compiles get a minute.
  timeoutMs: (segments) => (segments[1] === "ai" ? 300_000 : 60_000),
});

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
