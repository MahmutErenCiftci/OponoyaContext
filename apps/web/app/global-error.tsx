"use client";

import { productName } from "@devcontext/contracts/brand";
import { useSyncExternalStore } from "react";
import { defaultLocale, defineCopy, documentLocale, localeFromCookieHeader, type Locale } from "../lib/i18n";

const copy = defineCopy({
  tr: {
    title: `${productName} bu sayfayı açamadı.`,
    body: "Kaydettiğin hiçbir şey etkilenmedi. Sayfayı yeniden yüklemeyi dene.",
    reference: "Referans: ",
    retry: "Tekrar dene",
  },
  en: {
    title: `${productName} couldn't open this page.`,
    body: "Nothing you saved was affected. Try reloading the page.",
    reference: "Reference: ",
    retry: "Try again",
  },
});

const subscribe = () => () => {};
/** The stored choice, else the language the page was rendered in. */
const browserLocale = (): Locale => localeFromCookieHeader(document.cookie) ?? documentLocale();
const serverLocale = (): Locale => defaultLocale;

/**
 * Last-resort boundary for failures in the root layout itself. It renders its
 * own document without the app stylesheet or the locale provider, so the dark
 * palette is inlined (mirrors the dark `--canvas`, `--surface`, `--line`,
 * `--ink`, `--muted` and `--accent` tokens) and the language comes from the
 * locale cookie once in the browser. The error message is never shown; the
 * digest is enough to find the matching log line.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useSyncExternalStore(subscribe, browserLocale, serverLocale);
  const t = copy[locale];
  return (
    <html lang={locale}>
      <body style={{ margin: 0, background: "#0b0d10", color: "#f3f5f7", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section role="alert" style={{ maxWidth: 480, border: "1px solid #262c34", borderRadius: 16, padding: 32, background: "#111419" }}>
            <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>{t.title}</h1>
            <p style={{ color: "#98a0ad", lineHeight: 1.6, margin: "0 0 20px" }}>{t.body}</p>
            {error.digest && <p style={{ color: "#98a0ad", fontSize: 12 }}>{t.reference}{error.digest}</p>}
            <button onClick={() => reset()} style={{ background: "#c9ff55", color: "#0b0e08", border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 700, cursor: "pointer" }} type="button">{t.retry}</button>
          </section>
        </main>
      </body>
    </html>
  );
}
