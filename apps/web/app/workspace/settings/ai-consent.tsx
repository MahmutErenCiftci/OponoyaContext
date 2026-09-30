"use client";

import { aiStatusResponseSchema, type AiStatus } from "@devcontext/contracts";
import { ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { readApiError } from "../../../lib/errors";
import { formatDate } from "../../../lib/resource-labels";

const providerNames: Record<NonNullable<AiStatus["provider"]>, string> = { anthropic: "Anthropic (Claude)", fake: "test sağlayıcısı (ağ çağrısı yok)" };

/**
 * Explicit opt-in for AI suggestions. Without it nothing is ever sent to the
 * provider; with it data leaves only when the user asks for a suggestion, and
 * only what that suggestion needs. Revoking takes effect immediately.
 */
export function AiConsent({ initial, onNotice }: { initial: AiStatus; onNotice(text: string, tone?: "ok" | "error"): void }) {
  const [status, setStatus] = useState(initial);
  const [pending, setPending] = useState(false);
  const provider = status.provider ? providerNames[status.provider] : "AI sağlayıcısı";

  async function toggle(consent: boolean) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/ai/consent", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent }) });
      if (!response.ok) { onNotice((await readApiError(response)).message, "error"); return; }
      setStatus(aiStatusResponseSchema.parse(await response.json()).ai);
      onNotice(consent ? "AI önerilerine izin verildi." : "AI önerileri kapatıldı; artık hiçbir veri gönderilmez.");
    } catch {
      onNotice("Ayar kaydedilemedi. Tekrar dene.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ai-consent">
      <div className="identity">
        <span className="mark small"><Sparkle aria-hidden size={18} /></span>
        <div className="grow">
          <strong>AI önerileri: {status.consented ? "açık" : "kapalı"}</strong>
          <small className="muted" style={{ display: "block" }}>Sağlayıcı: {provider} · Bu ay: {status.quota.used}/{status.quota.limit} öneri · Kota {formatDate(status.quota.resetsAt)} tarihinde yenilenir.</small>
        </div>
        <label className="switch">
          <input checked={status.consented} disabled={pending} onChange={(event) => void toggle(event.target.checked)} type="checkbox" />
          <span>{status.consented ? "İzin verildi" : "İzin ver"}</span>
        </label>
      </div>
      <p className="muted small"><ShieldCheck aria-hidden size={16} /> Yalnızca bir karar için öneri istediğinde; o kararın kısıtları, proje özeti, etkin teknoloji yığını ve Kütüphanendeki kaynakların adı, türü ve kısa açıklaması gönderilir. Bağlantılar, notlar, kurulum komutları, e-posta adresin ve şifren gönderilmez. Öneriler sen kabul edene kadar hiçbir şeyi değiştirmez.</p>
    </div>
  );
}
