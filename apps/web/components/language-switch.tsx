"use client";

import { Translate } from "@phosphor-icons/react/dist/ssr";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { isEnglishLandingPath, localeCookie, localeNames, locales, parseLocale, type Locale } from "../lib/i18n";
import { useLocale } from "./locale-provider";

/** Named in both languages so either reader finds it. */
const label = "Dil / Language";

/**
 * Header control next to the theme picker: the current language code shows,
 * the native select keeps it accessible. The choice is stored in a cookie;
 * the landing switches between / and /en, every other page re-renders in place.
 */
export function LanguageSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = localeCookie(next);
    if (next === "en" && pathname === "/") router.push("/en");
    else if (next === "tr" && isEnglishLandingPath(pathname)) router.push("/");
    else startTransition(() => router.refresh());
  }

  return (
    <label aria-busy={pending} className="language-select" title={label}>
      <Translate aria-hidden size={18} />
      <span aria-hidden="true">{locale.toUpperCase()}</span>
      <select aria-label={label} onChange={(event) => choose(parseLocale(event.target.value) ?? locale)} value={locale}>
        {locales.map((item) => <option key={item} lang={item} value={item}>{localeNames[item]}</option>)}
      </select>
    </label>
  );
}
