import Link from "next/link";
import { redirect } from "next/navigation";
import { getBillingSummary } from "../../../lib/api";
import { entitlementSentence } from "../../../lib/billing-labels";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../../workspace/unavailable";
import { WorkspaceShell } from "../../workspace/workspace-shell";
import { FakePortal } from "./fake-portal";

export const dynamic = "force-dynamic";

/** Test-mode subscription portal of the fake provider; a real provider hosts its own. */
export default async function FakePortalPage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const summary = await getBillingSummary(session.cookieHeader);

  return (
    <WorkspaceShell active="Plan" user={session.user}>
      <div className="centered-panel">
        <span className="chip" style={{ justifySelf: "start", color: "var(--warning)" }}>Test aboneliği · gerçek ödeme yok</span>
        <h1>Test aboneliğini yönet</h1>
        <p>{summary ? entitlementSentence(summary.entitlement) : "Plan bilgileri yüklenemedi."} Aşağıdaki her işlem uygulamaya imzalı bir sağlayıcı olayı olarak iletilir; hiçbir ücret alınmaz.</p>
        {summary?.provider.testMode && summary.subscription.manageable
          ? <FakePortal />
          : <p className="form-error" role="alert">Yönetilecek simüle edilmiş bir abonelik yok. <Link href="/workspace/billing">Aboneliğe dön</Link></p>}
      </div>
    </WorkspaceShell>
  );
}
