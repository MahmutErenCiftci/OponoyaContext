import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHead } from "../../../components/page-heading";
import { getOwnFeedback } from "../../../lib/api";
import { feedbackKindLabels, feedbackStatusLabels } from "../../../lib/feedback-labels";
import { formatDateTime } from "../../../lib/resource-labels";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../unavailable";
import { WorkspaceShell } from "../workspace-shell";
import { FeedbackComposer } from "./feedback-composer";

export const metadata: Metadata = { title: "Geri bildirim" };

export default async function FeedbackPage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const sent = await getOwnFeedback(cookieHeader);

  return (
    <WorkspaceShell active="Feedback" user={user}>
      <section className="page feedback-page">
        <PageHead lead="Bir fikrin, bir şikayetin ya da karşılaştığın bir hata mı var? Yaz, doğrudan ekibe ulaşsın." title="Geri bildirim" />
        <div className="feedback-layout">
          <section aria-labelledby="feedback-new" className="card">
            <h2 className="section-title small" id="feedback-new">Yeni geri bildirim</h2>
            <FeedbackComposer />
          </section>
          <section aria-labelledby="feedback-sent" className="feedback-history">
            <h2 className="section-title small" id="feedback-sent">Gönderdiklerin</h2>
            {sent === null ? (
              <p className="muted" role="status">Gönderdiklerin şu an yüklenemedi. Sayfayı yenileyip tekrar dene.</p>
            ) : sent.length === 0 ? (
              <p className="muted">Henüz geri bildirim göndermedin.</p>
            ) : (
              <ol className="feedback-list">
                {sent.map((item) => (
                  <li key={item.id}>
                    <div className="feedback-meta">
                      <span className={`chip feedback-kind ${item.kind}`}>{feedbackKindLabels[item.kind]}</span>
                      <span className={`feedback-status ${item.status}`}>{feedbackStatusLabels[item.status]}</span>
                      <time className="muted small" dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
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
