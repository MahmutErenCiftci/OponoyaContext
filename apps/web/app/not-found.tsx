import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

/** Covers unknown routes and `notFound()` from workspace pages (missing or foreign entities look identical). */
export default function NotFound() {
  return (
    <main>
      <section className="unavailable">
        <MagnifyingGlass aria-hidden className="icon" size={120} weight="thin" />
        <h1>Bu sayfa çalışma alanında bulunamadı.</h1>
        <p>Bağlantı eskimiş olabilir, kayıt başka bir hesapta arşivlenmiş olabilir ya da adres yanlış yazılmış olabilir.</p>
        <div className="actions">
          <Link className="button primary large" href="/workspace">Genel bakışa dön</Link>
          <Link className="button" href="/workspace/projects">Projeler</Link>
        </div>
      </section>
    </main>
  );
}
