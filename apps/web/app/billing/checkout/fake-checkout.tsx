"use client";

import { billingRedirectResponseSchema } from "@devcontext/contracts";
import { useState } from "react";
import { useLocale } from "../../../components/locale-provider";
import { readApiError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { useHydrated } from "../../../lib/use-hydrated";

type Outcome = "paid" | "failed" | "canceled";

const copy = defineCopy({
  tr: {
    unreachable: "Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.",
    confirming: "Onaylanıyor…",
    pay: "Öde ve Pro’yu etkinleştir",
    fail: "Başarısız ödeme simüle et",
    cancel: "Vazgeç ve geri dön",
  },
  en: {
    unreachable: "The workspace can't be reached. Please try again.",
    confirming: "Confirming…",
    pay: "Pay and activate Pro",
    fail: "Simulate a failed payment",
    cancel: "Cancel and go back",
  },
});

export function FakeCheckout({ sessionId }: { sessionId: string }) {
  const t = copy[useLocale()];
  const hydrated = useHydrated();
  const [pending, setPending] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = !hydrated || pending !== null;

  async function complete(outcome: Outcome) {
    setPending(outcome);
    setError(null);
    try {
      const response = await fetch(`/api/billing/test/checkout/${encodeURIComponent(sessionId)}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome }),
      });
      if (!response.ok) { setError((await readApiError(response)).message); setPending(null); return; }
      const { url } = billingRedirectResponseSchema.parse(await response.json());
      window.location.assign(url);
    } catch {
      setError(t.unreachable);
      setPending(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button className="button primary" disabled={busy} onClick={() => void complete("paid")} type="button">{pending === "paid" ? t.confirming : t.pay}</button>
      <button className="button" disabled={busy} onClick={() => void complete("failed")} type="button">{t.fail}</button>
      <button className="button quiet" disabled={busy} onClick={() => void complete("canceled")} type="button">{t.cancel}</button>
      {error && <p className="form-error" role="alert" style={{ width: "100%" }}>{error}</p>}
    </div>
  );
}
