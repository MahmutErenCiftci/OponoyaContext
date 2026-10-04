"use client";

import { billingRedirectResponseSchema } from "@devcontext/contracts";
import { useState } from "react";
import { useLocale } from "../../../components/locale-provider";
import { readApiError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { useHydrated } from "../../../lib/use-hydrated";

type Action = "cancel" | "resume" | "renew" | "fail_renewal" | "expire";

const copy = defineCopy({
  tr: {
    actions: [
      { action: "cancel", label: "Dönem sonunda iptal et", hint: "Pro ödenen dönemin sonuna kadar etkin kalır; yenileme yapılmaz." },
      { action: "resume", label: "Aboneliğe devam et", hint: "Bekleyen iptali geri al." },
      { action: "renew", label: "Şimdi yenile", hint: "Yeni bir dönem başlatan ödenmiş fatura simüle et." },
      { action: "fail_renewal", label: "Başarısız yenileme simüle et", hint: "Aboneliği ödeme gecikmiş olarak işaretler; bir ek süre uygulanır." },
      { action: "expire", label: "Aboneliği şimdi bitir", hint: "Sağlayıcının aboneliği bugün kapattığını simüle et." },
    ] as Array<{ action: Action; label: string; hint: string }>,
    unreachable: "Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.",
    applying: "Uygulanıyor…",
    back: "Değişiklik yapmadan aboneliğe dön",
  },
  en: {
    actions: [
      { action: "cancel", label: "Cancel at period end", hint: "Pro stays active until the end of the paid period; it does not renew." },
      { action: "resume", label: "Resume subscription", hint: "Undo the pending cancellation." },
      { action: "renew", label: "Renew now", hint: "Simulate a paid invoice that starts a new period." },
      { action: "fail_renewal", label: "Simulate a failed renewal", hint: "Marks the subscription as past due; a grace period applies." },
      { action: "expire", label: "End subscription now", hint: "Simulate the provider closing the subscription today." },
    ],
    unreachable: "The workspace can't be reached. Please try again.",
    applying: "Applying…",
    back: "Back to subscription without changes",
  },
});

export function FakePortal() {
  const t = copy[useLocale()];
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
      setError(t.unreachable);
      setPending(null);
    }
  }

  return (
    <div className="portal-actions">
      {t.actions.map((item) => (
        <div className="portal-action" key={item.action}>
          <button className="button" disabled={busy} onClick={() => void run(item.action)} type="button">{pending === item.action ? t.applying : item.label}</button>
          <span>{item.hint}</span>
        </div>
      ))}
      {error && <p className="form-error" role="alert">{error}</p>}
      <a className="text-link" href="/workspace/billing?billing=portal">{t.back}</a>
    </div>
  );
}
