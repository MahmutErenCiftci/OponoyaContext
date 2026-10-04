import { apiProxy } from "../../../../lib/proxy";

/** Operator overview and feedback triage live under /v1/admin; the API checks ADMIN_USER_IDS on every call. */
const proxy = apiProxy({
  prefix: "/v1/admin",
  unavailableMessage: "Yönetim paneline şu an ulaşılamıyor.",
});

export const GET = proxy;
export const PATCH = proxy;
