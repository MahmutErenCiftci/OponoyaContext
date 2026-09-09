import Link from "next/link";
import { redirect } from "next/navigation";
import { getBillingSummary } from "../../../lib/api";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../../workspace/unavailable";
import { WorkspaceShell } from "../../workspace/workspace-shell";
import { FakeCheckout } from "./fake-checkout";

export const dynamic = "force-dynamic";

/** Test-mode checkout page of the fake provider; a real provider hosts its own page. */
export default async function FakeCheckoutPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const [{ session: sessionId }, summary] = await Promise.all([searchParams, getBillingSummary(session.cookieHeader)]);
  const pro = summary?.plans.find((plan) => plan.id === "pro") ?? null;

  return (
    <WorkspaceShell active="Plan" user={session.user}>
      <div className="centered-panel">
        <span className="chip" style={{ justifySelf: "start", color: "var(--warning)" }}>Test ödemesi · gerçek ödeme yok</span>
        <h1>Pro planı için test ödemesi</h1>
        <p>Bu, geliştirmede kullanılan yerleşik test sağlayıcısıdır. Kart istenmez ve para hareketi olmaz; seçtiğin sonuç, gerçek bir sağlayıcıda olduğu gibi imzalı bir webhook olarak uygulamaya iletilir.</p>
        {pro && <p><strong>Pro</strong> · {pro.priceLabel ?? "bu ortamda fiyat belirlenmedi"} · {pro.description}</p>}
        {sessionId && summary?.provider.testMode
          ? <FakeCheckout sessionId={sessionId} />
          : <p className="form-error" role="alert">Bu ödeme bağlantısında oturum bilgisi yok ya da test sağlayıcısı kapalı. <Link href="/workspace/billing">Aboneliğe dön</Link></p>}
      </div>
    </WorkspaceShell>
  );
}
