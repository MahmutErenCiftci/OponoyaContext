import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBillingSummary } from "../../../lib/api";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../../workspace/unavailable";
import { WorkspaceShell } from "../../workspace/workspace-shell";
import { FakeCheckout } from "./fake-checkout";

const copy = defineCopy({
  tr: {
    metaTitle: "Test ödemesi",
    chip: "Test ödemesi · gerçek ödeme yok",
    title: "Pro planı için test ödemesi",
    body: "Bu, geliştirmede kullanılan yerleşik test sağlayıcısıdır. Kart istenmez ve para hareketi olmaz; seçtiğin sonuç, gerçek bir sağlayıcıda olduğu gibi imzalı bir webhook olarak uygulamaya iletilir.",
    noPrice: "bu ortamda fiyat belirlenmedi",
    missing: "Bu ödeme bağlantısında oturum bilgisi yok ya da test sağlayıcısı kapalı. ",
    back: "Aboneliğe dön",
  },
  en: {
    metaTitle: "Test payment",
    chip: "Test payment · no real payment",
    title: "Test payment for the Pro plan",
    body: "This is the built-in test provider used in development. No card is asked for and no money moves; the outcome you pick reaches the app as a signed webhook, just as it would with a real provider.",
    noPrice: "no price set in this environment",
    missing: "This payment link has no session information, or the test provider is off. ",
    back: "Back to subscription",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].metaTitle };
}

/** Test-mode checkout page of the fake provider; a real provider hosts its own page. */
export default async function FakeCheckoutPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const [{ session: sessionId }, summary, locale] = await Promise.all([searchParams, getBillingSummary(session.cookieHeader), getLocale()]);
  const pro = summary?.plans.find((plan) => plan.id === "pro") ?? null;
  const t = copy[locale];

  return (
    <WorkspaceShell active="Plan" user={session.user}>
      <div className="centered-panel">
        <span className="chip" style={{ justifySelf: "start", color: "var(--warning)" }}>{t.chip}</span>
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        {pro && <p><strong>Pro</strong> · {pro.priceLabel ?? t.noPrice} · {pro.description}</p>}
        {sessionId && summary?.provider.testMode
          ? <FakeCheckout sessionId={sessionId} />
          : <p className="form-error" role="alert">{t.missing}<Link href="/workspace/billing">{t.back}</Link></p>}
      </div>
    </WorkspaceShell>
  );
}
