"use client";

import { billingRedirectResponseSchema } from "@devcontext/contracts";
import { useState } from "react";
import { readApiError } from "../../../lib/errors";
import { useHydrated } from "../../../lib/use-hydrated";

type Action = "cancel" | "resume" | "renew" | "fail_renewal" | "expire";

const actions: Array<{ action: Action; label: string; hint: string }> = [
  { action: "cancel", label: "Dönem sonunda iptal et", hint: "Pro ödenen dönemin sonuna kadar etkin kalır; yenileme yapılmaz." },
  { action: "resume", label: "Aboneliğe devam et", hint: "Bekleyen iptali geri al." },
  { action: "renew", label: "Şimdi yenile", hint: "Yeni bir dönem başlatan ödenmiş fatura simüle et." },
  { action: "fail_renewal", label: "Başarısız yenileme simüle et", hint: "Aboneliği ödeme gecikmiş olarak işaretler; bir ek süre uygulanır." },
  { action: "expire", label: "Aboneliği şimdi bitir", hint: "Sağlayıcının aboneliği bugün kapattığını simüle et." },
];

export function FakePortal() {
  const hydrated = useHydrated();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = !hydrated || pending !== null;

  async function run(action: Action) {
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/billing/test/portal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) { setError((await readApiError(response)).message); setPending(null); return; }
      const { url } = billingRedirectResponseSchema.parse(await response.json());
      window.location.assign(url);
    } catch {
      setError("Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.");
      setPending(null);
    }
  }

  return (
    <div className="portal-actions">
      {actions.map((item) => (
        <div className="portal-action" key={item.action}>
          <button className="button" disabled={busy} onClick={() => void run(item.action)} type="button">{pending === item.action ? "Uygulanıyor…" : item.label}</button>
          <span>{item.hint}</span>
        </div>
      ))}
      {error && <p className="form-error" role="alert">{error}</p>}
      <a className="text-link" href="/workspace/billing?billing=portal">Değişiklik yapmadan aboneliğe dön</a>
    </div>
  );
}
