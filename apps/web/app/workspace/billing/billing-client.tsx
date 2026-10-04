"use client";

import { billingReconcileResponseSchema, billingRedirectResponseSchema, exportTargetSchema, type BillingSummary, type PlanLimitKey } from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Flask } from "@phosphor-icons/react/dist/ssr";
import { useLocale } from "../../../components/locale-provider";
import { PageHead } from "../../../components/page-heading";
import { Roadmap } from "../../../components/roadmap";
import { entitlementSentence, exportTargetLabels, limitLabels, subscriptionStatusLabels } from "../../../lib/billing-labels";
import { readApiError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { formatDate } from "../../../lib/resource-labels";
import { proPricing } from "../../../lib/roadmap";
import { useHydrated } from "../../../lib/use-hydrated";

export type ReturnState = "success" | "canceled" | "portal" | null;

const limitKeys: PlanLimitKey[] = ["projects", "resources", "profiles", "recipes"];

type Pricing = (typeof proPricing)["tr"];

const copy = defineCopy({
  tr: {
    devLabel: "Geliştirme aşaması",
    devTitle: "Oponoya şu an geliştirme aşamasında.",
    devText: "Bu yüzden herhangi bir ücret gerektirmez; V1’deki tüm özellikleri ücretsiz kullanabilirsin. Pro, V2 ile gelecek; Free hesap ise her zaman kalacak.",
    usageAria: (used: number, limit: number, label: string) => `${used} / ${limit} ${label.toLowerCase()} kullanıldı`,
    canceled: "Ödeme iptal edildi. Hiçbir şey değişmedi; mevcut planındasın.",
    portal: "Abonelik ayarları güncellendi.",
    thanks: "Teşekkürler! Pro planın etkin.",
    notVerified: "Ödeme henüz doğrulanamadı. Birazdan yenile; hiçbir şey kaybolmaz.",
    notCompleted: "Ödeme tamamlanmadı. Hâlâ Free plandasın.",
    unreachable: "Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.",
    title: "Abonelik",
    loadFailed: "Plan bilgileri yüklenemedi. Verilerin ve mevcut planın etkilenmedi; birazdan tekrar dene.",
    lead: "Planını, kullanımını ve Pro özelliklerini incele. Limitler yalnızca aktif kayıtlara uygulanır; planın bittiğinde verilerin korunur.",
    paymentProblem: "Ödeme sorunu: son yenileme başarısız oldu.",
    updatePaymentMethod: "Ödeme yöntemini “Aboneliği yönet” ile güncelle.",
    proPlan: "Pro plan",
    freePlan: "Free plan",
    currentPeriod: "Mevcut dönem: ",
    status: "Durum: ",
    cancelAtPeriodEnd: " · dönem sonunda iptal",
    openingCheckout: "Ödeme sayfası açılıyor…",
    upgrade: "Pro’ya geç",
    opening: "Açılıyor…",
    manage: "Aboneliği yönet",
    upgradeUnavailable: "Bu ortamda yükseltme henüz açık değil. Free planını kullanmaya devam edebilirsin.",
    testMode: "Test modu · gerçek ödeme yok",
    cancelNote: "İstediğin zaman “Aboneliği yönet” ile iptal edebilirsin; Pro ödenen dönemin sonuna kadar etkin kalır ve iptalden sonra sessizce yenilenmez. Plan bittiğinde her şey okunabilir kalır; yalnızca Free limitlerinin üzerinde yeni kayıt açamazsın.",
    usage: "Kullanım",
    archiveNote: "Bir projeyi, kaynağı, profili veya tarifi arşivlemek yerini hemen boşaltır.",
    compare: "Free ve Pro karşılaştırması",
    feature: "Özellik",
    exportRow: (label: string) => `${label} dışa aktarımı`,
    included: "Dahil",
    bundle: "Zip paketi (tüm dosyalar)",
    history: "Gösterilen sürüm geçmişi",
    last: (count: number) => `Son ${count}`,
    diff: "Sürüm karşılaştırması",
    portability: "Verilerini içe ve dışa aktarma",
    price: "Fiyat",
    free: "Ücretsiz",
    proPrice: (pricing: Pricing) => `V2 ile · ${pricing.launch} / ${pricing.period} (gelişim indirimi, sonra ${pricing.regular})`,
    compareNote: "Derleyici deterministiktir ve AI kredisi gerektirmez; sınırsız AI kullanımı vaat edilmez. Takım planları bu sürümün parçası değildir. Verilerine mi ihtiyacın var? Her planda",
    exportLink: "verilerini dışa aktar",
  },
  en: {
    devLabel: "Development stage",
    devTitle: "Oponoya is in development right now.",
    devText: "That is why nothing costs money; you can use every V1 feature for free. Pro arrives with V2, and the Free account will always stay.",
    usageAria: (used: number, limit: number, label: string) => `${used} of ${limit} ${label.toLowerCase()} used`,
    canceled: "The payment was canceled. Nothing changed; you are on your current plan.",
    portal: "Your subscription settings were updated.",
    thanks: "Thank you! Your Pro plan is active.",
    notVerified: "The payment could not be verified yet. Refresh in a moment; nothing is lost.",
    notCompleted: "The payment was not completed. You are still on Free.",
    unreachable: "The workspace can't be reached. Please try again.",
    title: "Subscription",
    loadFailed: "Plan details could not be loaded. Your data and current plan are not affected; try again in a moment.",
    lead: "Review your plan, usage and Pro features. Limits apply only to active records; your data is kept when your plan ends.",
    paymentProblem: "Payment problem: the last renewal failed.",
    updatePaymentMethod: "Update your payment method with “Manage subscription”.",
    proPlan: "Pro plan",
    freePlan: "Free plan",
    currentPeriod: "Current period: ",
    status: "Status: ",
    cancelAtPeriodEnd: " · cancels at period end",
    openingCheckout: "Opening checkout…",
    upgrade: "Upgrade to Pro",
    opening: "Opening…",
    manage: "Manage subscription",
    upgradeUnavailable: "Upgrading is not available in this environment yet. You can keep using your Free plan.",
    testMode: "Test mode · no real payments",
    cancelNote: "You can cancel any time with “Manage subscription”; Pro stays active until the end of the paid period and does not renew quietly after you cancel. When the plan ends everything stays readable; you just can't create new records above the Free limits.",
    usage: "Usage",
    archiveNote: "Archiving a project, resource, profile or recipe frees its slot right away.",
    compare: "Free and Pro compared",
    feature: "Feature",
    exportRow: (label: string) => `${label} export`,
    included: "Included",
    bundle: "Zip bundle (all files)",
    history: "Version history shown",
    last: (count: number) => `Last ${count}`,
    diff: "Version comparison",
    portability: "Import and export your data",
    price: "Price",
    free: "Free",
    proPrice: (pricing: Pricing) => `With V2 · ${pricing.launch} / ${pricing.period} (development discount, then ${pricing.regular})`,
    compareNote: "The compiler is deterministic and needs no AI credits; unlimited AI use is not promised. Team plans are not part of this version. Need your data? On every plan you can",
    exportLink: "export your data",
  },
});

/** Owner decision 2026-09-30: nothing is charged while the product is in development. */
function DevelopmentNotice() {
  const t = copy[useLocale()];
  return (
    <aside aria-label={t.devLabel} className="dev-notice">
      <span aria-hidden="true" className="dev-notice-icon"><Flask size={24} /></span>
      <div>
        <strong>{t.devTitle}</strong>
        <p>{t.devText}</p>
      </div>
    </aside>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const t = copy[useLocale()];
  const ratio = limit === 0 ? 1 : Math.min(1, used / limit);
  const full = used >= limit;
  return (
    <div className={`usage-meter${full ? " full" : ""}`}>
      <div className="usage-meter-head"><strong>{label}</strong><span aria-label={t.usageAria(used, limit, label)}>{used} / {limit}</span></div>
      <div aria-hidden="true" className="usage-meter-bar"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></div>
    </div>
  );
}

export function BillingClient({ summary: initial, returnState }: { summary: BillingSummary | null; returnState: ReturnState }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const locale = useLocale();
  const t = copy[locale];
  const [summary, setSummary] = useState(initial);
  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);
  const [notice, setNotice] = useState<string | null>(
    returnState === "canceled" ? t.canceled
      : returnState === "portal" ? t.portal
        : returnState === "success" && initial?.entitlement.plan === "pro" ? t.thanks
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
        if (!response.ok) { setNotice(t.notVerified); return; }
        const result = billingReconcileResponseSchema.parse(await response.json());
        setSummary((current) => current ? { ...current, entitlement: result.entitlement, subscription: result.subscription } : current);
        setNotice(result.entitlement.plan === "pro" ? t.thanks : t.notCompleted);
        router.refresh();
      } catch {
        setNotice(t.notVerified);
      }
    };
    void confirm();
  }, [returnState, summary, router, t]);

  async function redirectTo(path: "checkout" | "portal") {
    setPending(path);
    setError(null);
    try {
      const response = await fetch(`/api/billing/${path}`, { method: "POST" });
      if (!response.ok) { setError((await readApiError(response)).message); setPending(null); return; }
      const { url } = billingRedirectResponseSchema.parse(await response.json());
      window.location.assign(url);
    } catch {
      setError(t.unreachable);
      setPending(null);
    }
  }

  if (!summary) {
    return (
      <section className="page">
        <PageHead title={t.title} />
        <DevelopmentNotice />
        <p className="note warning" role="status" style={{ marginTop: 20 }}>{t.loadFailed}</p>
        <Roadmap />
      </section>
    );
  }

  const { entitlement, usage, subscription, provider, plans } = summary;
  const free = plans.find((plan) => plan.id === "free")!;
  const pro = plans.find((plan) => plan.id === "pro")!;
  const isPro = entitlement.plan === "pro";
  const included = (value: boolean) => (value ? t.included : "—");

  return (
    <section className="page">
      <PageHead lead={t.lead} title={t.title} />
      {notice && <p className="toast" role="status">{notice}</p>}
      <DevelopmentNotice />
      <Roadmap />
      {entitlement.paymentProblem && (
        <p className="note warning" role="alert" style={{ marginTop: 20 }}>{t.paymentProblem} {entitlementSentence(entitlement, locale)} {subscription.manageable ? t.updatePaymentMethod : ""}</p>
      )}
      <div className="grid-2" style={{ marginTop: 28 }}>
        <section aria-labelledby="current-plan" className="card">
          <div className="section-head">
            <h3 className="section-title small" id="current-plan">{isPro ? t.proPlan : t.freePlan}</h3>
            <span className={`plan-badge plan-${entitlement.plan}`}>{isPro ? "PRO" : "FREE"}</span>
          </div>
          <p>{entitlementSentence(entitlement, locale)}</p>
          {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
            <dl style={{ marginTop: 14, display: "grid", gap: 6 }} className="small">
              <div><dt className="muted" style={{ display: "inline" }}>{t.currentPeriod}</dt><dd style={{ display: "inline" }}>{formatDate(subscription.currentPeriodStart, locale)} – {formatDate(subscription.currentPeriodEnd, locale)}</dd></div>
              <div><dt className="muted" style={{ display: "inline" }}>{t.status}</dt><dd style={{ display: "inline" }}>{subscriptionStatusLabels[locale][subscription.status]}{subscription.cancelAtPeriodEnd ? t.cancelAtPeriodEnd : ""}</dd></div>
            </dl>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
            {!isPro && provider.configured && (
              <button className="button primary" disabled={!hydrated || pending !== null} onClick={() => void redirectTo("checkout")} type="button">{pending === "checkout" ? t.openingCheckout : t.upgrade}</button>
            )}
            {subscription.manageable && provider.configured && (
              <button className="button" disabled={!hydrated || pending !== null} onClick={() => void redirectTo("portal")} type="button">{pending === "portal" ? t.opening : t.manage}</button>
            )}
            {!provider.configured && <span className="muted small">{t.upgradeUnavailable}</span>}
            {provider.testMode && <span className="chip" style={{ color: "var(--warning)" }}>{t.testMode}</span>}
            {error && <p className="form-error" role="alert" style={{ width: "100%" }}>{error}</p>}
          </div>
          <p className="muted small" style={{ marginTop: 16 }}>{t.cancelNote}</p>
        </section>
        <section aria-labelledby="usage" className="card">
          <h3 className="section-title small" id="usage">{t.usage}</h3>
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {limitKeys.map((key) => <UsageMeter key={key} label={limitLabels[locale][key]} limit={usage[key].limit} used={usage[key].used} />)}
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>{t.archiveNote}</p>
        </section>
      </div>
      <section aria-labelledby="compare" className="card" style={{ marginTop: 24 }}>
        <h3 className="section-title small" id="compare">{t.compare}</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">{t.feature}</th><th scope="col">Free</th><th scope="col">Pro</th></tr></thead>
            <tbody>
              {limitKeys.map((key) => <tr key={key}><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{limitLabels[locale][key]}</th><td>{free.limits[key]}</td><td>{pro.limits[key]}</td></tr>)}
              {exportTargetSchema.options.map((target) => (
                <tr key={target}><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{t.exportRow(exportTargetLabels[locale][target])}</th><td>{included(free.features.exportTargets.includes(target))}</td><td>{included(pro.features.exportTargets.includes(target))}</td></tr>
              ))}
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{t.bundle}</th><td>{included(free.features.bundle)}</td><td>{included(pro.features.bundle)}</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{t.history}</th><td>{t.last(free.features.historyLimit)}</td><td>{t.last(pro.features.historyLimit)}</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{t.diff}</th><td>{included(free.features.diff)}</td><td>{included(pro.features.diff)}</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{t.portability}</th><td>{t.included}</td><td>{t.included}</td></tr>
              <tr><th scope="row" style={{ fontWeight: 500, color: "var(--ink)" }}>{t.price}</th><td>{t.free}</td><td>{pro.priceLabel ?? t.proPrice(proPricing[locale])}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          {t.compareNote} <Link className="text-link" href="/workspace/settings#import">{t.exportLink}</Link>.
        </p>
      </section>
    </section>
  );
}
