"use client";

import { adminFeedbackListResponseSchema, feedbackResponseSchema, feedbackStatusSchema, type AdminFeedback, type FeedbackStatus } from "@devcontext/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { responseError } from "../../lib/errors";
import { feedbackKindLabels, feedbackStatusLabels } from "../../lib/feedback-labels";
import { formatDateTime } from "../../lib/resource-labels";

type Filter = FeedbackStatus | "all";
const filters: Filter[] = [...feedbackStatusSchema.options, "all"];

/** Operator inbox: one triage state at a time, status changes saved immediately. Messages render as plain text. */
export function FeedbackInbox({ initial, counts }: { initial: AdminFeedback[] | null; counts: Record<FeedbackStatus, number> }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("new");
  const [items, setItems] = useState<AdminFeedback[] | null>(initial);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initial === null ? "Geri bildirimler yüklenemedi." : null);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  async function load(next: Filter) {
    setFilter(next);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/feedback?status=${next}`);
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const parsed = adminFeedbackListResponseSchema.safeParse(await response.json());
      if (parsed.success) setItems(parsed.data.feedback);
      else setError("Geri bildirimler yüklenemedi.");
    } catch {
      setError("Yönetim paneline şu an ulaşılamıyor.");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(item: AdminFeedback, status: FeedbackStatus) {
    setSaving(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const parsed = feedbackResponseSchema.safeParse(await response.json());
      if (!parsed.success) return;
      const updated = parsed.data.feedback;
      // A report that leaves the shown state leaves the list; the counts come back with the refresh.
      setItems((current) => current?.flatMap((entry) => {
        if (entry.id !== item.id) return [entry];
        return filter === "all" || filter === updated.status ? [{ ...entry, ...updated }] : [];
      }) ?? null);
      router.refresh();
    } catch {
      setError("Durum kaydedilemedi. Tekrar dene.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section aria-labelledby="admin-feedback-title" className="overview-section admin-inbox">
      <div className="section-head">
        <h2 className="section-title small" id="admin-feedback-title">Geri bildirimler</h2>
        <span className="muted small">{total} kayıt</span>
      </div>
      <div aria-label="Duruma göre filtrele" className="pill-group" role="group">
        {filters.map((option) => (
          <button aria-pressed={filter === option} disabled={loading} key={option} onClick={() => void load(option)} type="button">
            {option === "all" ? "Tümü" : feedbackStatusLabels[option]}
            <span className="pill-count">{option === "all" ? total : counts[option]}</span>
          </button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {items && items.length === 0 && !loading && (
        <p className="muted admin-inbox-empty">{filter === "new" ? "Yeni geri bildirim yok." : "Bu durumda geri bildirim yok."}</p>
      )}
      {items && items.length > 0 && (
        <ol aria-busy={loading} className="admin-inbox-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="feedback-meta">
                <span className={`chip feedback-kind ${item.kind}`}>{feedbackKindLabels[item.kind]}</span>
                <strong>{item.user.name}</strong>
                <a className="text-link small" href={`mailto:${item.user.email}?subject=${encodeURIComponent("Geri bildirimin hakkında")}`}>{item.user.email}</a>
                <time className="muted small" dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
              </div>
              <p className="feedback-message">{item.message}</p>
              <div className="admin-inbox-foot">
                {item.pagePath ? <span className="muted small">Sayfa: <code>{item.pagePath}</code></span> : <span />}
                <label className="admin-inbox-status">
                  <span className="muted small">Durum</span>
                  <select className="select" disabled={saving === item.id} onChange={(event) => void changeStatus(item, feedbackStatusSchema.parse(event.target.value))} value={item.status}>
                    {feedbackStatusSchema.options.map((status) => <option key={status} value={status}>{feedbackStatusLabels[status]}</option>)}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
