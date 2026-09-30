import { portableLimits } from "@devcontext/contracts";
import { apiProxy, defaultMaxBodyBytes } from "../../../../lib/proxy";

/** Settings, onboarding, samples, export and import all live under /v1/workspace on the API. */
const proxy = apiProxy({
  prefix: "/v1/workspace",
  unavailableMessage: "Çalışma alanına şu an ulaşılamıyor.",
  // Only the portable import accepts documents larger than the default cap.
  maxBodyBytes: (segments) => (segments[0] === "import" ? portableLimits.requestBytes : defaultMaxBodyBytes),
  timeoutMs: (segments) => (segments[0] === "import" || segments[0] === "export" || segments[0] === "samples" ? 120_000 : 30_000),
});

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
