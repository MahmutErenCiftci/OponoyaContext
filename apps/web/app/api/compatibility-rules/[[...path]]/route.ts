import { apiProxy } from "../../../../lib/proxy";

const proxy = apiProxy({ prefix: "/v1/compatibility-rules", unavailableMessage: "Uyumluluk hizmetine şu an ulaşılamıyor." });

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
