"use client";

import { aiStatusResponseSchema, type AiStatus } from "@devcontext/contracts";
import { ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { useLocale } from "../../../components/locale-provider";
import { readApiError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { formatDate } from "../../../lib/resource-labels";

const copy = defineCopy({
  tr: {
    providers: { anthropic: "Anthropic (Claude)", fake: "test sağlayıcısı (ağ çağrısı yok)" } satisfies Record<NonNullable<AiStatus["provider"]>, string>,
    providerFallback: "AI sağlayıcısı",
    allowed: "AI önerilerine izin verildi.",
    revoked: "AI önerileri kapatıldı; artık hiçbir veri gönderilmez.",
    saveFailed: "Ayar kaydedilemedi. Tekrar dene.",
    status: (on: boolean) => `AI önerileri: ${on ? "açık" : "kapalı"}`,
    details: (provider: string, used: number, limit: number, resetsAt: string) => `Sağlayıcı: ${provider} · Bu ay: ${used}/${limit} öneri · Kota ${resetsAt} tarihinde yenilenir.`,
    consented: "İzin verildi",
    consent: "İzin ver",
    disclosure: "Yalnızca bir karar için öneri istediğinde; o kararın kısıtları, proje özeti, etkin teknoloji yığını ve Kütüphanendeki kaynakların adı, türü ve kısa açıklaması gönderilir. Bağlantılar, notlar, kurulum komutları, e-posta adresin ve şifren gönderilmez. Öneriler sen kabul edene kadar hiçbir şeyi değiştirmez.",
  },
  en: {
    providers: { anthropic: "Anthropic (Claude)", fake: "test provider (no network calls)" },
    providerFallback: "AI provider",
    allowed: "AI suggestions are allowed.",
    revoked: "AI suggestions are off; no data is sent anymore.",
    saveFailed: "The setting could not be saved. Try again.",
    status: (on: boolean) => `AI suggestions: ${on ? "on" : "off"}`,
    details: (provider: string, used: number, limit: number, resetsAt: string) => `Provider: ${provider} · This month: ${used}/${limit} suggestions · The quota resets on ${resetsAt}.`,
    consented: "Allowed",
    consent: "Allow",
    disclosure: "Only when you ask for a suggestion for a decision: that decision's constraints, the project summary, the active technology stack, and the name, type and short description of the resources in your Library are sent. Links, notes, install commands, your e-mail address and your password are never sent. Suggestions change nothing until you accept them.",
  },
});

/**
 * Explicit opt-in for AI suggestions. Without it nothing is ever sent to the
 * provider; with it data leaves only when the user asks for a suggestion, and
 * only what that suggestion needs. Revoking takes effect immediately.
 */
export function AiConsent({ initial, onNotice }: { initial: AiStatus; onNotice(text: string, tone?: "ok" | "error"): void }) {
  const locale = useLocale();
  const t = copy[locale];
  const [status, setStatus] = useState(initial);
  const [pending, setPending] = useState(false);
  const provider = status.provider ? t.providers[status.provider] : t.providerFallback;

  async function toggle(consent: boolean) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/ai/consent", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent }) });
      if (!response.ok) { onNotice((await readApiError(response)).message, "error"); return; }
      setStatus(aiStatusResponseSchema.parse(await response.json()).ai);
      onNotice(consent ? t.allowed : t.revoked);
    } catch {
      onNotice(t.saveFailed, "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ai-consent">
      <div className="identity">
        <span className="mark small"><Sparkle aria-hidden size={18} /></span>
        <div className="grow">
          <strong>{t.status(status.consented)}</strong>
          <small className="muted" style={{ display: "block" }}>{t.details(provider, status.quota.used, status.quota.limit, formatDate(status.quota.resetsAt, locale))}</small>
        </div>
        <label className="switch">
          <input checked={status.consented} disabled={pending} onChange={(event) => void toggle(event.target.checked)} type="checkbox" />
          <span>{status.consented ? t.consented : t.consent}</span>
        </label>
      </div>
      <p className="muted small"><ShieldCheck aria-hidden size={16} /> {t.disclosure}</p>
    </div>
  );
}
