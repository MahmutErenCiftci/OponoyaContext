import "./globals.css";
import { productName } from "@devcontext/contracts/brand";
import type { Metadata, Viewport } from "next";
import { DM_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import { LocaleProvider } from "../components/locale-provider";
import { brandCopy } from "../lib/brand-copy";
import { getLocale } from "../lib/locale-server";
import { siteUrl } from "../lib/site";
import { themeAttribute } from "../lib/theme";
import { readTheme } from "../lib/theme-server";

// Fonts are downloaded at build time and served from this origin: no request reaches Google from a visitor's browser.
const manrope = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-manrope", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const base = siteUrl();
  const locale = await getLocale();
  const { tagline, description } = brandCopy[locale];
  return {
    ...(base ? { metadataBase: base } : {}),
    title: { default: `${productName} · ${tagline}`, template: `%s · ${productName}` },
    description,
    applicationName: productName,
    openGraph: { type: "website", siteName: productName, title: productName, description: tagline, locale: locale === "en" ? "en_US" : "tr_TR" },
    twitter: { card: "summary_large_image", title: productName, description: tagline },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  // Mirrors the light and dark `--canvas` tokens so the browser chrome matches the page.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
  ],
  colorScheme: "light dark",
};

/** The theme and language are read here so the first paint already uses the chosen palette and language (no flash). */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [theme, locale] = await Promise.all([readTheme(), getLocale()]);
  return (
    <html className={`${manrope.variable} ${dmMono.variable}`} data-theme={themeAttribute(theme)} lang={locale}>
      <body><LocaleProvider locale={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
