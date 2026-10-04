import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHead } from "../../../components/page-heading";
import { getOwnFeedback } from "../../../lib/api";
import { feedbackKindLabels, feedbackStatusLabels } from "../../../lib/feedback-labels";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { formatDateTime } from "../../../lib/resource-labels";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { FeedbackComposer } from "./feedback-composer";

const copy = defineCopy({
  tr: {
    title: "Geri bildirim",
    lead: "Bir fikrin, bir şikayetin ya da karşılaştığın bir hata mı var? Yaz, doğrudan ekibe ulaşsın.",
    newFeedback: "Yeni geri bildirim",
    sent: "Gönderdiklerin",
    sentFailed: "Gönderdiklerin şu an yüklenemedi. Sayfayı yenileyip tekrar dene.",
    none: "Henüz geri bildirim göndermedin.",
  },
  en: {
    title: "Feedback",
    lead: "Have an idea, a complaint or a bug you ran into? Write it down and it goes straight to the team.",
    newFeedback: "New feedback",
    sent: "What you sent",
    sentFailed: "What you sent could not be loaded right now. Refresh the page and try again.",
    none: "You haven't sent any feedback yet.",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].title };
}

export default async function FeedbackPage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [sent, locale] = await Promise.all([getOwnFeedback(cookieHeader), getLocale()]);
  const t = copy[locale];

  return (
    <WorkspaceShell active="Feedback" user={user}>
      <section className="page feedback-page">
        <PageHead lead={t.lead} title={t.title} />
        <div className="feedback-layout">
          <section aria-labelledby="feedback-new" className="card">
            <h2 className="section-title small" id="feedback-new">{t.newFeedback}</h2>
            <FeedbackComposer />
          </section>
          <section aria-labelledby="feedback-sent" className="feedback-history">
            <h2 className="section-title small" id="feedback-sent">{t.sent}</h2>
            {sent === null ? (
              <p className="muted" role="status">{t.sentFailed}</p>
            ) : sent.length === 0 ? (
              <p className="muted">{t.none}</p>
            ) : (
              <ol className="feedback-list">
                {sent.map((item) => (
                  <li key={item.id}>
                    <div className="feedback-meta">
                      <span className={`chip feedback-kind ${item.kind}`}>{feedbackKindLabels[locale][item.kind]}</span>
                      <span className={`feedback-status ${item.status}`}>{feedbackStatusLabels[locale][item.status]}</span>
                      <time className="muted small" dateTime={item.createdAt}>{formatDateTime(item.createdAt, locale)}</time>
                    </div>
                    <p className="feedback-message">{item.message}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </section>
    </WorkspaceShell>
  );
}
