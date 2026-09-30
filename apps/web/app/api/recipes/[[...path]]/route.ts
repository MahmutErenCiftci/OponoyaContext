import { apiProxy } from "../../../../lib/proxy";

const proxy = apiProxy({ prefix: "/v1/recipes", unavailableMessage: "Tarif hizmetine şu an ulaşılamıyor." });

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
