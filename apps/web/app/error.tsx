"use client";

import { Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary. The error message is never rendered because
 * server errors may carry internal details; the digest is enough to find the
 * matching API/web log line.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route failed", error.digest ?? "no-digest");
  }, [error.digest]);

  return (
    <main>
      <section aria-live="assertive" className="unavailable" role="alert">
        <Warning aria-hidden className="icon" size={120} weight="thin" />
        <h1>Bu ekran görüntülenemedi.</h1>
        <p>Kütüphanen, projelerin ve talimatların olduğu gibi duruyor. Ekranı yeniden dene; sorun sürerse genel bakışa dön.</p>
        {error.digest && <p className="foot">Referans: <code>{error.digest}</code></p>}
        <div className="actions">
          <button className="button primary large" onClick={() => reset()} type="button">Tekrar dene</button>
          <Link className="button" href="/workspace">Genel bakışa dön</Link>
        </div>
      </section>
    </main>
  );
}
