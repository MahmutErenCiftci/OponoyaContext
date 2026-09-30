"use client";

import {
  acceptAiSuggestionResponseSchema,
  aiSuggestionListResponseSchema,
  aiSuggestionResponseSchema,
  type AiStatus,
  type AiSuggestion,
  type ProjectDecisionView,
} from "@devcontext/contracts";
import { Info, LockSimple, Sparkle, Star, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readApiError } from "../lib/errors";
import { catalogSlugFor } from "../lib/logos";
import { typeLabels } from "../lib/resource-labels";
import { warningTitles } from "../lib/warning-labels";
import { TechLogo } from "./tech-logo";

/** Turkish text for the content-free codes the AI routes answer with. */
const failureText: Record<string, string> = {
  ai_unavailable: "AI hizmetine şu an ulaşılamıyor. Birazdan tekrar dene.",
  ai_rate_limited: "AI hizmeti şu an yoğun. Birazdan tekrar dene.",
  ai_timeout: "AI yanıtı çok uzun sürdü. Tekrar dene.",
  ai_refused: "AI bu isteği yanıtlamadı. Kısıtları düzenleyip tekrar dene ya da kararı kendin ver.",
  ai_invalid_output: "AI yanıtı kullanılamadı. Tekrar dene.",
  ai_misconfigured: "AI önerileri geçici olarak kullanılamıyor.",
  ai_consent_required: "AI önerileri için önce Ayarlar › Gizlilik ve veriler’den izin ver.",
  ai_quota_exceeded: "Bu ayki AI önerisi kotan doldu. Kota ayın başında yenilenir.",
  slot_not_delegated: "Bu karar artık AI’a bırakılmış değil.",
  project_archived: "Arşivdeki projede AI önerisi istenemez; önce projeyi geri yükle.",
  suggestion_stale: "Karar bu öneriden sonra değişti. Yeni bir öneri iste.",
  suggestion_not_pending: "Bu öneri zaten sonuçlandırıldı.",
  suggestion_without_choice: "Bu öneride kabul edilecek bir seçim yok.",
};

const confidenceText: Record<AiSuggestion["proposal"]["confidence"], string> = { low: "düşük", medium: "orta", high: "yüksek" };

async function failureMessage(response: Response) {
  const failure = await readApiError(response);
  const code = failure.details[0]?.code;
  return (code && failureText[code]) || failure.message;
}

/**
 * AI proposal for one delegated slot (V1.5 groundwork). Nothing changes until
 * the user accepts: accepting writes an ordinary Project decision with the
 * rationale attached; rejecting only closes the suggestion. Shown only when
 * the deployment has an AI provider.
 */
export function AiSuggestionPanel({ projectId, slot, status, onAccepted }: {
  projectId: string;
  slot: string;
  status: AiStatus;
  onAccepted(view: ProjectDecisionView): void;
}) {
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [pending, setPending] = useState<"request" | "accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(status.quota.remaining);

  // A pending proposal for this slot is shown again instead of spending quota on a new one.
  useEffect(() => {
    if (!status.consented) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/suggestions?status=pending&limit=20`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const found = aiSuggestionListResponseSchema.parse(await response.json()).suggestions.find((item) => item.slot === slot);
        if (found) setSuggestion(found);
      } catch {
        // Nothing pending or the list is unavailable: the request button still works.
      }
    })();
    return () => controller.abort();
  }, [projectId, slot, status.consented]);

  if (!status.consented) {
    return (
      <section aria-labelledby="ai-panel-title" className="ai-panel">
        <h3 id="ai-panel-title"><Sparkle aria-hidden size={20} />AI önerisi</h3>
        <p className="muted small">Bu karar AI’a bırakıldı. Kütüphanenden somut bir öneri almak için <Link className="text-link" href="/workspace/settings?section=settings-privacy">Ayarlar › Gizlilik ve veriler</Link>’den AI önerilerine izin ver. İzin vermeden hiçbir veri gönderilmez.</p>
      </section>
    );
  }

  async function request() {
    if (pending) return;
    setPending("request");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/suggestions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slot }),
      });
      if (!response.ok) { setError(await failureMessage(response)); return; }
      setSuggestion(aiSuggestionResponseSchema.parse(await response.json()).suggestion);
      if (response.status === 201) setRemaining((value) => Math.max(0, value - 1));
    } catch {
      setError(failureText.ai_unavailable!);
    } finally {
      setPending(null);
    }
  }

  async function decide(action: "accept" | "reject", mode: "PREFERRED" | "LOCKED" = "PREFERRED") {
    if (!suggestion || pending) return;
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/ai/suggestions/${encodeURIComponent(suggestion.id)}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "accept" ? { mode } : {}),
      });
      if (!response.ok) { setError(await failureMessage(response)); return; }
      if (action === "accept") {
        onAccepted(acceptAiSuggestionResponseSchema.parse(await response.json()).decision);
        return;
      }
      setSuggestion(null);
    } catch {
      setError(failureText.ai_unavailable!);
    } finally {
      setPending(null);
    }
  }

  const choice = suggestion?.resource ?? null;
  return (
    <section aria-busy={pending === "request"} aria-labelledby="ai-panel-title" className="ai-panel">
      <h3 id="ai-panel-title"><Sparkle aria-hidden size={20} />AI önerisi</h3>
      {!suggestion && (
        <>
          <p className="muted small">Kısıtlarına, projenin etkin yığınına ve Kütüphanene bakarak tek bir seçim önerir. Öneri, sen kabul edene kadar hiçbir şeyi değiştirmez. Bu ay kalan: {remaining}/{status.quota.limit}.</p>
          <button className="button" disabled={pending !== null || remaining === 0} onClick={() => void request()} type="button">
            <Sparkle aria-hidden size={18} />{pending === "request" ? "Öneri hazırlanıyor…" : "AI önerisi iste"}
          </button>
        </>
      )}
      {suggestion && (
        <div className="ai-proposal" role="region" aria-label="Önerilen seçim">
          {choice ? (
            <div className="identity">
              <span className="mark small"><TechLogo name={choice.name} size={20} slug={catalogSlugFor(choice)} /></span>
              <span><strong>{choice.name}</strong> <small className="muted">· {typeLabels[choice.type]} · güven: {confidenceText[suggestion.proposal.confidence]}</small></span>
            </div>
          ) : (
            <p className="note" role="note"><Info aria-hidden size={18} />Kütüphanende bu karara uygun bir kaynak bulunamadı.</p>
          )}
          <p>{suggestion.proposal.rationale}</p>
          {suggestion.alternatives.length > 0 && (
            <>
              <h4>Alternatifler</h4>
              <ul>{suggestion.alternatives.map((item) => <li key={item.resource.id}><strong>{item.resource.name}</strong>: {item.reason}</li>)}</ul>
            </>
          )}
          {suggestion.proposal.risks.length > 0 && (
            <>
              <h4>Riskler</h4>
              <ul>{suggestion.proposal.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
            </>
          )}
          {suggestion.warnings.length > 0 && (
            <ul className="ai-warnings">{suggestion.warnings.map((warning, index) => <li key={`${warning.code}-${index}`}><Warning aria-hidden size={16} /><span><strong>{warningTitles[warning.code]}:</strong> {warning.message}</span></li>)}</ul>
          )}
          <p className="muted small">Öneriyi {suggestion.provider === "fake" ? "test sağlayıcısı" : suggestion.model} hazırladı. Kabul edersen gerekçesiyle birlikte proje kararı olarak kaydedilir.</p>
          <div className="actions">
            {choice && <button className="button primary" disabled={pending !== null} onClick={() => void decide("accept", "PREFERRED")} type="button"><Star aria-hidden size={18} />Tercih edilen olarak kabul et</button>}
            {choice && <button className="button" disabled={pending !== null} onClick={() => void decide("accept", "LOCKED")} type="button"><LockSimple aria-hidden size={18} />Kilitle</button>}
            <button className="button quiet" disabled={pending !== null} onClick={() => void decide("reject")} type="button">Reddet</button>
          </div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
