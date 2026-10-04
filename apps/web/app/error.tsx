"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect } from "react";
import { useLocale } from "../components/locale-provider";
import { defineCopy } from "../lib/i18n";

const copy = defineCopy({
  tr: {
    title: "Bu ekran görüntülenemedi.",
    body: "Kütüphanen, projelerin ve talimatların olduğu gibi duruyor. Ekranı yeniden dene; sorun sürerse genel bakışa dön.",
    reference: "Referans: ",
    retry: "Tekrar dene",
    overview: "Genel bakışa dön",
  },
  en: {
    title: "This screen could not be displayed.",
    body: "Your Library, projects and instructions are untouched. Try the screen again; if the problem persists, go back to the overview.",
    reference: "Reference: ",
    retry: "Try again",
    overview: "Back to overview",
  },
});

/**
 * Route-level error boundary. The error message is never rendered because
 * server errors may carry internal details; the digest is enough to find the
 * matching API/web log line.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = copy[useLocale()];
  useEffect(() => {
    console.error("Route failed", error.digest ?? "no-digest");
  }, [error.digest]);

  return (
    <main>
      <section aria-live="assertive" className="unavailable" role="alert">
        <Warning aria-hidden className="icon" size={120} weight="thin" />
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        {error.digest && <p className="foot">{t.reference}<code>{error.digest}</code></p>}
        <div className="actions">
          <button className="button primary large" onClick={() => reset()} type="button">{t.retry}</button>
          <Link className="button" href="/workspace">{t.overview}</Link>
        </div>
      </section>
    </main>
  );
}
