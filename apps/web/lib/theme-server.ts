import { cookies } from "next/headers";
import { parseTheme, themeCookieName, type Theme } from "./theme";

/** Server-side read of the persisted theme preference. */
export async function readTheme(): Promise<Theme> {
  const store = await cookies();
  return parseTheme(store.get(themeCookieName)?.value);
}
