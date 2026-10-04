import { CheckCircle, CloudSlash, House } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { RetryButton } from "../../components/retry-button";
import { defineCopy } from "../../lib/i18n";
import { getLocale } from "../../lib/locale-server";
import { WorkspaceShell } from "./workspace-shell";

const copy = defineCopy({
  tr: {
    title: "Çalışma alanına şu an ulaşılamıyor.",
    lead: "Bağlantı yeniden kurulduğunda kaldığın yerden devam edebilirsin.",
    safe: "Kaydettiğin veriler etkilenmedi.",
    home: "Ana sayfaya dön",
    foot: "Oturumunu yeniden açman gerekmiyor.",
  },
  en: {
    title: "The workspace can't be reached right now.",
    lead: "Once the connection is back, you can pick up where you left off.",
    safe: "Your saved data is not affected.",
    home: "Back to the home page",
    foot: "You don't need to sign in again.",
  },
});

/**
 * Shown when the API cannot be reached at all. The shell stays, nothing is
 * lost: the session cookie remains in the browser and retry re-checks. This is
 * a connectivity state, never a 404 and never a forced sign-out.
 */
export async function ServiceUnavailable() {
  const t = copy[await getLocale()];
  return (
    <WorkspaceShell active={null} user={null}>
      <section aria-live="assertive" className="unavailable" role="alert">
        <CloudSlash aria-hidden className="icon" size={168} weight="thin" />
        <h1>{t.title}</h1>
        <p>{t.lead}</p>
        <p className="status-label ok"><CheckCircle aria-hidden size={20} />{t.safe}</p>
        <div className="actions">
          <RetryButton className="button primary large" />
          <Link className="button" href="/"><House aria-hidden size={20} />{t.home}</Link>
        </div>
        <p className="foot">{t.foot}</p>
      </section>
    </WorkspaceShell>
  );
}
