/**
 * Interface languages. Turkish is the default and the reference copy; English
 * mirrors it key for key. Copy lives next to the screen that shows it:
 *
 *   const copy = defineCopy({ tr: { title: "Projeler" }, en: { title: "Projects" } });
 *   const t = copy[locale];          // server: `await getLocale()`, client: `useLocale()`
 *
 * `defineCopy` infers the shape from `tr` only, so a missing or extra English
 * key is a type error. Functions are fine as values (plurals, interpolation).
 * This module has no server or React imports and is safe everywhere.
 */
export const locales = ["tr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "tr";

/** Persisted choice; the `devcontext` prefix is a technical identifier and stays (AGENTS.md "Product name"). */
export const localeCookieName = "devcontext-locale";
/** Set by the request proxy (apps/web/proxy.ts) so every server component reads one resolved value. */
export const localeHeaderName = "x-devcontext-locale";
const localeCookieMaxAge = 60 * 60 * 24 * 365;

/** BCP 47 tags for `Intl` formatting. */
export const intlLocales: Record<Locale, string> = { tr: "tr-TR", en: "en-US" };
/** Each language named in itself, for the switcher. */
export const localeNames: Record<Locale, string> = { tr: "Türkçe", en: "English" };

export function parseLocale(value: string | null | undefined): Locale | null {
  return value === "tr" || value === "en" ? value : null;
}

export function defineCopy<T>(copy: { tr: T; en: NoInfer<T> }): Record<Locale, T> {
  return copy;
}

/**
 * Picks Turkish or English from an Accept-Language header by quality. A
 * browser that asks for neither (German, Arabic, …) gets English, the more
 * widely read of the two; no header at all keeps the Turkish default.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header?.trim()) return defaultLocale;
  const ranked = header.split(",").map((part, index) => {
    const [tag = "", ...params] = part.trim().split(";");
    const quality = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
    const q = quality ? Number(quality.slice(2)) : 1;
    return { language: tag.trim().toLowerCase().split("-")[0] ?? "", q: Number.isFinite(q) ? q : 0, index };
  }).filter((entry) => entry.language && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const entry of ranked) {
    const locale = parseLocale(entry.language);
    if (locale) return locale;
  }
  return ranked.length > 0 ? "en" : defaultLocale;
}

export function localeFromCookieHeader(header: string | null | undefined): Locale | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === localeCookieName) return parseLocale(decodeURIComponent(rest.join("=")));
  }
  return null;
}

export function localeCookie(locale: Locale): string {
  return `${localeCookieName}=${locale}; Path=/; Max-Age=${localeCookieMaxAge}; SameSite=Lax`;
}

/** The English landing lives at /en; every other page follows the visitor's preference. */
export function isEnglishLandingPath(pathname: string) {
  return pathname === "/en" || pathname.startsWith("/en/");
}

/**
 * Browser-only: the language the root layout rendered (`<html lang>`). For
 * plain helpers outside React (error text for a failed fetch); components use
 * `useLocale()` instead.
 */
export function documentLocale(): Locale {
  if (typeof document === "undefined") return defaultLocale;
  return parseLocale(document.documentElement.lang) ?? defaultLocale;
}
