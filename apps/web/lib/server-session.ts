import { cookies } from "next/headers";
import { readSession, serializeCookies, type SessionState } from "./session";

/** Server-component helper: resolves the session from the incoming request cookies. */
export async function loadSession(): Promise<SessionState> {
  const store = await cookies();
  return readSession(serializeCookies(store.getAll()));
}
