import { cookies, headers } from "next/headers";
import { cache } from "react";
import { localeCookieName, localeFromAcceptLanguage, localeHeaderName, parseLocale, type Locale } from "./i18n";

/**
 * Server-side language of the current request. The request proxy resolves it
 * once (path, cookie, Accept-Language) and passes it in a header; requests the
 * proxy skips (router prefetches) fall back to the same rules here. Cached per
 * request, so a page, its metadata and the layout agree.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const requestHeaders = await headers();
  const resolved = parseLocale(requestHeaders.get(localeHeaderName));
  if (resolved) return resolved;
  const chosen = parseLocale((await cookies()).get(localeCookieName)?.value);
  return chosen ?? localeFromAcceptLanguage(requestHeaders.get("accept-language"));
});
