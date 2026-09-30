import { headers } from "next/headers";
import { cache } from "react";
import { readSession, type SessionState } from "./session";

/**
 * Server-component helper: resolves the session from the incoming request.
 * The raw `Cookie` header is forwarded as the browser sent it; re-serializing
 * decoded cookie values could let a crafted cookie smuggle a second session
 * into the API call. Cached per request, so a page and its metadata share one
 * lookup.
 */
export const loadSession = cache(async (): Promise<SessionState> => {
  const cookieHeader = (await headers()).get("cookie") ?? "";
  return readSession(cookieHeader);
});
