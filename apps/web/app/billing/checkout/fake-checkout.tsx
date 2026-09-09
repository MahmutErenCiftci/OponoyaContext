"use client";

import { billingRedirectResponseSchema } from "@devcontext/contracts";
import { useState } from "react";
import { readApiError } from "../../../lib/errors";
import { useHydrated } from "../../../lib/use-hydrated";

type Outcome = "paid" | "failed" | "canceled";

export function FakeCheckout({ sessionId }: { sessionId: string }) {
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
      setError("Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.");
      setPending(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button className="button primary" disabled={busy} onClick={() => void complete("paid")} type="button">{pending === "paid" ? "Onaylanıyor…" : "Öde ve Pro’yu etkinleştir"}</button>
      <button className="button" disabled={busy} onClick={() => void complete("failed")} type="button">Başarısız ödeme simüle et</button>
      <button className="button quiet" disabled={busy} onClick={() => void complete("canceled")} type="button">Vazgeç ve geri dön</button>
      {error && <p className="form-error" role="alert" style={{ width: "100%" }}>{error}</p>}
    </div>
  );
}
