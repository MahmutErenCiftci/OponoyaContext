import { apiProxy } from "../../../../lib/proxy";

/** Sending a report and reading one's own reports live under /v1/feedback on the API. */
const proxy = apiProxy({
  prefix: "/v1/feedback",
  unavailableMessage: "Geri bildirim şu an gönderilemiyor.",
});

export const GET = proxy;
export const POST = proxy;
