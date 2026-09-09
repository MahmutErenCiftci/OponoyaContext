import { currentUserResponseSchema, type CurrentUser } from "@devcontext/contracts";
import { getApiBaseUrl } from "./api";

/**
 * Distinguishes "not signed in" from "the API cannot be reached" so pages can
 * show a retry screen instead of bouncing a signed-in user to the sign-in form
 * during an outage.
 */
export type SessionState =
  | { status: "authenticated"; user: CurrentUser; cookieHeader: string }
  | { status: "anonymous"; cookieHeader: string }
  | { status: "unavailable"; cookieHeader: string };

export async function readSession(
  cookieHeader: string,
  apiUrl: string = process.env.API_URL ?? "http://localhost:4000",
): Promise<SessionState> {
  try {
    const response = await fetch(new URL("/v1/me", getApiBaseUrl(apiUrl)), {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      signal: AbortSignal.timeout(3_000),
    });
    if (response.status === 401) return { status: "anonymous", cookieHeader };
    if (!response.ok) return { status: "unavailable", cookieHeader };
    const parsed = currentUserResponseSchema.safeParse(await response.json());
    return parsed.success ? { status: "authenticated", user: parsed.data.user, cookieHeader } : { status: "unavailable", cookieHeader };
  } catch {
    return { status: "unavailable", cookieHeader };
  }
}

export function serializeCookies(values: { name: string; value: string }[]) {
  return values.map(({ name, value }) => `${name}=${value}`).join("; ");
}
