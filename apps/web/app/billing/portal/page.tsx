import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBillingSummary } from "../../../lib/api";
import { entitlementSentence } from "../../../lib/billing-labels";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { loadSession } from "../../../lib/server-session";
import { ServiceUnavailable } from "../../workspace/unavailable";
import { WorkspaceShell } from "../../workspace/workspace-shell";
import { FakePortal } from "./fake-portal";

const copy = defineCopy({
  tr: {
    metaTitle: "Abonelik yönetimi",
    chip: "Test aboneliği · gerçek ödeme yok",
    title: "Test aboneliğini yönet",
    planUnavailable: "Plan bilgileri yüklenemedi.",
    body: " Aşağıdaki her işlem uygulamaya imzalı bir sağlayıcı olayı olarak iletilir; hiçbir ücret alınmaz.",
    nothingToManage: "Yönetilecek simüle edilmiş bir abonelik yok. ",
    back: "Aboneliğe dön",
  },
  en: {
    metaTitle: "Manage subscription",
    chip: "Test subscription · no real payment",
    title: "Manage the test subscription",
    planUnavailable: "Plan details could not be loaded.",
    body: " Every action below reaches the app as a signed provider event; nothing is charged.",
    nothingToManage: "There is no simulated subscription to manage. ",
    back: "Back to subscription",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].metaTitle };
}

/** Test-mode subscription portal of the fake provider; a real provider hosts its own. */
export default async function FakePortalPage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const [summary, locale] = await Promise.all([getBillingSummary(session.cookieHeader), getLocale()]);
  const t = copy[locale];

  return (
    <WorkspaceShell active="Plan" user={session.user}>
      <div className="centered-panel">
        <span className="chip" style={{ justifySelf: "start", color: "var(--warning)" }}>{t.chip}</span>
        <h1>{t.title}</h1>
        <p>{summary ? entitlementSentence(summary.entitlement, locale) : t.planUnavailable}{t.body}</p>
        {summary?.provider.testMode && summary.subscription.manageable
          ? <FakePortal />
          : <p className="form-error" role="alert">{t.nothingToManage}<Link href="/workspace/billing">{t.back}</Link></p>}
      </div>
    </WorkspaceShell>
  );
}
