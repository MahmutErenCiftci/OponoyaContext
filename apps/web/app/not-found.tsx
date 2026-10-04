import type { Metadata } from "next";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { defineCopy } from "../lib/i18n";
import { getLocale } from "../lib/locale-server";

const copy = defineCopy({
  tr: {
    metaTitle: "Sayfa bulunamadı",
    title: "Bu sayfa bulunamadı.",
    body: "Bağlantı eskimiş olabilir, kayıt başka bir hesapta arşivlenmiş olabilir ya da adres yanlış yazılmış olabilir.",
    overview: "Genel bakışa dön",
    home: "Ana sayfa",
  },
  en: {
    metaTitle: "Page not found",
    title: "This page could not be found.",
    body: "The link may be out of date, the record may be archived or belong to another account, or the address may be mistyped.",
    overview: "Back to overview",
    home: "Home",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].metaTitle };
}

/** Covers unknown routes and `notFound()` from workspace pages (missing or foreign entities look identical). */
export default async function NotFound() {
  const t = copy[await getLocale()];
  return (
    <main>
      <section className="unavailable">
        <MagnifyingGlass aria-hidden className="icon" size={120} weight="thin" />
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        <div className="actions">
          <Link className="button primary large" href="/workspace">{t.overview}</Link>
          <Link className="button" href="/">{t.home}</Link>
        </div>
      </section>
    </main>
  );
}
