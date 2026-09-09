import { CheckCircle, CloudSlash, House } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { RetryButton } from "../../components/retry-button";
import { readTheme } from "../../lib/theme-server";
import { WorkspaceNavigation } from "./workspace-navigation";

/**
 * Shown when the API cannot be reached at all. The shell stays, nothing is
 * lost: the session cookie remains in the browser and retry re-checks. This is
 * a connectivity state, never a 404 and never a forced sign-out.
 */
export async function ServiceUnavailable() {
  const theme = await readTheme();
  return (
    <div className="workspace-shell">
      <WorkspaceNavigation active={null} theme={theme} user={null} />
      <main id="workspace-content">
        <section aria-live="assertive" className="unavailable" role="alert">
          <CloudSlash aria-hidden className="icon" size={168} weight="thin" />
          <h1>Çalışma alanına şu an ulaşılamıyor.</h1>
          <p>Bağlantı yeniden kurulduğunda kaldığın yerden devam edebilirsin.</p>
          <p className="status-label ok"><CheckCircle aria-hidden size={20} />Kaydettiğin veriler etkilenmedi.</p>
          <div className="actions">
            <RetryButton className="button primary large" />
            <Link className="button" href="/"><House aria-hidden size={20} />Ana sayfaya dön</Link>
          </div>
          <p className="foot">Oturumunu yeniden açman gerekmiyor.</p>
        </section>
      </main>
    </div>
  );
}
