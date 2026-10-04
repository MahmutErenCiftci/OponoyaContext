"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultLocale, type Locale } from "../lib/i18n";

const LocaleContext = createContext<Locale>(defaultLocale);

/** Mounted once by the root layout with the language the server rendered. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

/** Interface language inside client components. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
