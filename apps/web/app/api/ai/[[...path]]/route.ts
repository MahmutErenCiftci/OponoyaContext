import { apiProxy } from "../../../../lib/proxy";

/** AI status, consent and suggestion accept/reject live under /v1/ai; project-scoped requests go through /api/projects. */
const proxy = apiProxy({ prefix: "/v1/ai", unavailableMessage: "AI hizmetine şu an ulaşılamıyor." });

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
