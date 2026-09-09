"use client";

import { billingReconcileResponseSchema, billingRedirectResponseSchema, exportTargetSchema, type BillingSummary, type PlanLimitKey } from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHead } from "../../../components/page-heading";
import { entitlementSentence, exportTargetLabels, limitLabels } from "../../../lib/billing-labels";
import { readApiError } from "../../../lib/errors";
import { formatDate } from "../../../lib/resource-labels";
import { useHydrated } from "../../../lib/use-hydrated";

export type ReturnState = "success" | "canceled" | "portal" | null;

const limitKeys: PlanLimitKey[] = ["projects", "resources", "profiles", "recipes"];

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const ratio = limit === 0 ? 1 : Math.min(1, used / limit);
  const full = used >= limit;
  return (
    <div className={`usage-meter${full ? " full" : ""}`}>
      <div className="usage-meter-head"><strong>{label}</strong><span aria-label={`${used} / ${limit} ${label.toLowerCase()} kullanıldı`}>{used} / {limit}</span></div>
      <div aria-hidden="true" className="usage-meter-bar"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></div>
    </div>
  );
}

export function BillingClient({ summary: initial, returnState }: { summary: BillingSummary | null; returnState: ReturnState }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [summary, setSummary] = useState(initial);
  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);
  const [notice, setNotice] = useState<string | null>(
    returnState === "canceled" ? "Ödeme iptal edildi. Hiçbir şey değişmedi; mevcut planındasın."
      : returnState === "portal" ? "Abonelik ayarları güncellendi."
        : returnState === "success" && initial?.entitlement.plan === "pro" ? "Teşekkürler! Pro planın etkin."
          : null,
  );
  const [error, setError] = useState<string | null>(null);
  const reconciled = useRef(false);

  // After a checkout return the provider's webhook may still be in flight: confirm from the provider once.
  useEffect(() => {
    if (returnState !== "success" || reconciled.current || !summary?.provider.configured || summary.entitlement.plan === "pro") return;
    reconciled.current = true;
    const confirm = async () => {
      try {
        const response = await fetch("/api/billing/reconcile", { method: "POST" });
        if (!response.ok) { setNotice("Ödeme henüz doğrulanamadı. Birazdan yenile; hiçbir şey kaybolmaz."); return; }
        const result = billingReconcileResponseSchema.parse(await response.json());
        setSummary((current) => current ? { ...current, entitlement: result.entitlement, subscription: result.subscription } : current);
        setNotice(result.entitlement.plan === "pro" ? "Teşekkürler! Pro planın etkin." : "Ödeme tamamlanmadı. Hâlâ Free plandasın.");
        router.refresh();
      } catch {
        setNotice("Ödeme henüz doğrulanamadı. Birazdan yenile; hiçbir şey kaybolmaz.");
      }
    };
    void confirm();
  }, [returnState, summary, router]);

  async function redirectTo(path: "checkout" | "portal") {
    setPending(path);
    setError(null);
    try {
      const response = await fetch(`/api/billing/${path}`, { method: "POST" });
      if (!response.ok) { setError((await readApiError(response)).message); return; }
      const { url } = billingRedirectResponseSchema.parse(await response.json());
      window.location.assign(url);
    } catch {
      setError("Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.");
      setPending(null);
    }
  }

  if (!summary) {
    return (
      <section className="page">
        <PageHead title="Abonelik" />
        <p className="note warning" role="status" style={{ marginTop: 20 }}>Plan bilgileri yüklenemedi. Verilerin ve mevcut planın etkilenmedi; birazdan tekrar dene.</p>
      </section>
    );
  }

  const { entitlement, usage, subscription, provider, plans } = summary;
  const free = plans.find((plan) => plan.id === "free")!;
  const pro = plans.find((plan) => plan.id === "pro")!;
  const isPro = entitlement.plan === "pro";

  return (
    <section className="page">
      <PageHead lead="Planını, kullanımını ve Pro özelliklerini incele. Limitler yalnızca aktif kayıtlara uygulanır; planın bittiğinde verilerin korunur." title="Abonelik" />
      {notice && <p className="toast" role="status">{notice}</p>}
      {entitlement.paymentProblem && (
        <p className="note warning" role="alert" style={{ marginTop: 20 }}>Ödeme sorunu: son yenileme başarısız oldu. {entitlementSentence(entitlement)} {subscription.manageable ? "Ödeme yöntemini “Aboneliği yönet” ile güncelle." : ""}</p>
      )}
      <div className="grid-2" style={{ marginTop: 28 }}>
        <section aria-labelledby="current-plan" className="card">
          <div className="section-head">
            <h3 className="section-title small" id="current-plan">{isPro ? "Pro plan" : "Free plan"}</h3>
            <span className={`plan-badge plan-${entitlement.plan}`}>{isPro ? "PRO" : "FREE"}</span>
          </div>
          <p>{entitlementSentence(entitlement)}</p>
          {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
            <dl style={{ marginTop: 14, display: "grid", gap: 6 }} className="small">
              <div><dt className="muted" style={{ display: "inline" }}>Mevcut dönem: </dt><dd style={{ display: "inline" }}>{formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}</dd></div>
              <div><dt className="muted" style={{ display: "inline" }}>Durum: </dt><dd style={{ display: "inline" }}>{subscription.status.replace("_", " ")}{subscription.cancelAtPeriodEnd ? " · dönem sonunda iptal" : ""}</dd></div>
            </dl>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
            {!isPro && provider.configured && (
              <button className="button primary" disabled={!hydrated || pending !== null} onClick={() => void redirectTo("checkout")} type="button">{pending === "checkout" ? "Ödeme sayfası açılıyor…" : "Pro’ya geç"}</button>
            )}
            {subscription.manageable && provider.configured && (
              <button className="button" disabled={!hydrated || pending !== null} onClick={() => void redirectTo("portal")} type="button">{pending === "portal" ? "Açılıyor…" : "Aboneliği yönet"}</button>
            )}
            {!provider.configured && <span className="muted small">Bu ortamda yükseltme henüz açık değil. Free planını kullanmaya devam edebilirsin.</span>}
            {provider.testMode && <span className="chip" style={{ color: "var(--warning)" }}>Test modu · gerçek ödeme yok</span>}
            {error && <p className="form-error" role="alert" style={{ width: "100%" }}>{error}</p>}
          </div>
          <p className="muted small" style={{ marginTop: 16 }}>
            İstediğin zaman “Aboneliği yönet” ile iptal edebilirsin; Pro ödenen dönemin sonuna kadar etkin kalır ve iptalden sonra sessizce yenilenmez.
            Plan bittiğinde her şey okunabilir kalır; yalnızca Free limitlerinin üzerinde yeni kayıt açamazsın.
          </p>
        </section>
        <section aria-labelledby="usage" className="card">
          <h3 className="section-title small" id="usage">Kullanım</h3>
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {limitKeys.map((key) => <UsageMeter key={key} label={limitLabels[key]} limit={usage[key].limit} used={usage[key].used} />)}
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>Bir projeyi, kaynağı, profili veya tarifi arşivlemek yerini hemen boşaltır.</p>
        </section>
      </div>
      <section aria-labelledby="compare" className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title small" id="compare">Free ve Pro karşılaştırması</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Özellik</th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead>
            <tbody>
              {limitKeys.map((key) => <tr key={key}><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{limitLabels[key]}</th><td>{free.limits[key]}</td><td>{pro.limits[key]}</td></tr>)}
              {exportTargetSchema.options.map((target) => (
                <tr key={target}><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{exportTargetLabels[target]} dışa aktarımı</th><td>{free.features.exportTargets.includes(target) ? "Dahil" : "—"}</td><td>{pro.features.exportTargets.includes(target) ? "Dahil" : "—"}</td></tr>
              ))}
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>Zip paketi (tüm dosyalar)</th><td>{free.features.bundle ? "Dahil" : "—"}</td><td>{pro.features.bundle ? "Dahil" : "—"}</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>Gösterilen sürüm geçmişi</th><td>Son {free.features.historyLimit}</td><td>Son {pro.features.historyLimit}</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>Sürüm karşılaştırması</th><td>{free.features.diff ? "Dahil" : "—"}</td><td>{pro.features.diff ? "Dahil" : "—"}</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>Verilerini içe ve dışa aktarma</th><td>Dahil</td><td>Dahil</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>Fiyat</th><td>Ücretsiz</td><td>{pro.priceLabel ?? "Ödeme sistemi açıldığında duyurulacak"}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          Derleyici deterministiktir ve AI kredisi gerektirmez; sınırsız AI kullanımı vaat edilmez. Takım planları bu sürümün parçası değildir.
          Verilerine mi ihtiyacın var? Her planda <Link className="text-link" href="/workspace/settings#import">verilerini dışa aktar</Link>.
        </p>
      </section>
    </section>
  );
}
