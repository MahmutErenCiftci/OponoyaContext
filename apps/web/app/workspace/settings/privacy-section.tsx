"use client";

import { accountSummaryResponseSchema, deleteAccountResponseSchema, type AccountSummary, type AiStatus, type CurrentUser } from "@devcontext/contracts";
import { ArrowSquareOut, CheckCircle, CreditCard, DownloadSimple, ShieldCheck, Trash, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DrawerFrame } from "../../../components/drawer";
import { useLocale } from "../../../components/locale-provider";
import { readApiError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { formatDateTime } from "../../../lib/resource-labels";
import { AiComingSoon } from "../../../components/coming-soon";
import { AiConsent } from "./ai-consent";

const storedKeys: Array<keyof AccountSummary["stored"]> = [
  "resources",
  "tags",
  "decisions",
  "profiles",
  "recipes",
  "projects",
  "compatibilityRules",
  "contextVersions",
  "exports",
  "importRequests",
  "auditEvents",
  "aiSuggestions",
  "feedback",
  "sessions",
];

const copy = defineCopy({
  tr: {
    stored: {
      resources: "Kaynak",
      tags: "Etiket",
      decisions: "Karar",
      profiles: "Profil",
      recipes: "Tarif",
      projects: "Proje",
      compatibilityRules: "Uyumluluk kuralı",
      contextVersions: "Talimat sürümü",
      exports: "Dışa aktarma kaydı",
      importRequests: "İçe aktarma kaydı",
      auditEvents: "Etkinlik kaydı",
      aiSuggestions: "AI önerisi",
      feedback: "Geri bildirim",
      sessions: "Açık oturum",
    } satisfies Record<keyof AccountSummary["stored"], string>,
    /** Copy for the content-free codes the API returns; anything else falls back to the API message. */
    failures: {
      invalid_password: "Şifre doğru değil. Hiçbir şey silinmedi.",
      confirmation_mismatch: "Yazdığın e-posta hesabınla eşleşmiyor. Hiçbir şey silinmedi.",
      billing_provider_unavailable: "Ödeme sağlayıcısına ulaşılamadığı için aboneliğin iptal edilemedi. Hiçbir şey silinmedi; birkaç dakika sonra yeniden dene.",
      billing_provider_not_configured: "Aboneliğin bu sunucuda yapılandırılmamış bir ödeme sağlayıcısına bağlı, bu yüzden otomatik iptal edilemiyor. Hiçbir şey silinmedi; destekle iletişime geç ya da faturalama yapılandırıldığında yeniden dene.",
    } as Record<string, string>,
    accountDownloaded: "Hesap verilerin indirildi.",
    exportFailed: "Dışa aktarma indirilemedi. Tekrar dene.",
    accountUnreachable: "Hesap hizmetine ulaşılamıyor. Hiçbir şey silinmedi; tekrar dene.",
    title: "Gizlilik ve veriler",
    leadBefore: "Hesabında ne saklandığını gör, tüm verini indir, bağlantıları ve hesabını yönet. Ayrıntılar ",
    privacyPolicy: "Gizlilik Politikası",
    and: " ve ",
    terms: "Kullanım Şartları",
    leadAfter: "’nda.",
    summaryFailed: "Hesap özeti şu an yüklenemedi. Dışa aktarma ve silme yine denenebilir; sayıları görmek için sayfayı yenile.",
    storedTitle: "Saklanan veriler",
    storedLead: (created: string) => `Hesabın ${created} tarihinde açıldı. Aşağıdaki her kayıt yalnızca sana aittir ve hesap silindiğinde tek işlemde kaldırılır.`,
    storedLabel: "Saklanan kayıt sayıları",
    aiOnStrong: "Talimatlar her zaman bu sunucuda deterministik olarak derlenir.",
    aiOnText: " AI önerileri isteğe bağlıdır; aşağıdan açıp kapatabilirsin.",
    aiOffStrong: "Dış yapay zekâ işleme: kapalı.",
    aiOffText: " Talimatlar bu sunucuda deterministik olarak derlenir; hiçbir veri bir AI sağlayıcısına gönderilmez.",
    textOnly: "İçe aktardığın URL’ler, promptlar, kurallar ve kurulum komutları yalnızca metin olarak saklanır; asla açılmaz, indirilmez ya da çalıştırılmaz.",
    contentFree: "Etkinlik kaydı ve sunucu günlükleri içerik değil, yalnızca işlem türü, kayıt kimliği ve sayı tutar.",
    aiSoonAction: "AI önerilerine izin ver",
    aiSoonText: "İsteğe bağlı AI önerileri Pro ile V2’de geliyor; en yeni AI özellikleri V3’ten sonra. Açılana kadar hiçbir veri bir AI sağlayıcısına gönderilmez.",
    aiSoonTitle: "AI önerileri",
    downloadTitle: "Verini indir",
    downloadLead: "Hesap, ayarlar, çalışma alanı (taşınabilir biçim), derlenmiş talimat sürümleri, dışa aktarma ve etkinlik kayıtları tek JSON dosyasında. Şifre özeti, oturum belirteci veya sağlayıcı sırları hiçbir zaman dahil değildir.",
    preparing: "Hazırlanıyor…",
    downloadAccount: "Hesap verilerini indir",
    connectionsTitle: "Bağlantılar",
    connectionsLead: "Hesabına bağlı dış hizmetler. Silme, bağlı aboneliği sağlayıcıda da iptal eder.",
    paymentProvider: "Ödeme sağlayıcısı",
    testMode: " (test modu)",
    billingLinked: (provider: string | null, plan: string, status: string) => `${provider ?? "sağlayıcı"} · ${plan} planı · durum: ${status}`,
    billingUnlinked: (plan: string) => `Bağlı abonelik yok · ${plan} planı`,
    billingNotConfigured: "Bu kurulumda ödeme sağlayıcısı yapılandırılmadı; Free plan.",
    billingUnknown: "Durum yüklenemedi.",
    manageSubscription: "Aboneliği yönet",
    noOtherServices: "GitHub gibi başka bir dış hizmet bağlı değil; bu sürümde bağlanamaz.",
    deleteTitle: "Hesabı sil",
    deleteLead: "Hesabını, tüm kayıtlarını ve oturumlarını kalıcı olarak siler; bağlı abonelik sağlayıcıda iptal edilir. Geri alınamaz. Silmeden önce verini indirmeni öneririz.",
    blockedNote: (attemptedAt: string | null, reason: string) => `Son silme denemesi${attemptedAt ? ` (${attemptedAt})` : ""} dış adımda durdu: ${reason} Hesabın ve verilerin silinmedi; aynı isteği yeniden gönderebilirsin.`,
    noReason: "sebep kaydedilmedi",
    retryDelete: "Silmeyi yeniden dene…",
    deleteAccount: "Hesabımı sil…",
    closeDialog: "Silme penceresini kapat",
    cancel: "Vazgeç",
    deleting: "Siliniyor…",
    deleteForever: "Hesabımı kalıcı olarak sil",
    dialogSubtitle: "Bu işlem geri alınamaz.",
    dialogTitle: "Hesabını kalıcı olarak sil",
    scopeIntro: "Şunlar kalıcı olarak silinecek:",
    scopeAccount: (email: string) => `Hesabın (${email}) ve tüm açık oturumların`,
    scopeRecords: "Kaynaklar, etiketler, kararlar, profiller, tarifler ve projeler",
    scopeHistory: "Derlenmiş talimat sürümleri, dışa/içe aktarma ve etkinlik kayıtları",
    scopeBilling: "Bağlı abonelik sağlayıcıda iptal edilir; yalnızca asgari fatura kaydı (sağlayıcı kimlikleri, plan, tarih) kalır",
    confirmEmail: "Onaylamak için e-posta adresini yaz",
    password: "Şifren",
    safetyNote: "Silme, şifren doğrulanmadan ve abonelik iptali tamamlanmadan başlamaz. Bir adım başarısız olursa hiçbir şey silinmez ve durum burada gösterilir.",
  },
  en: {
    stored: {
      resources: "Resources",
      tags: "Tags",
      decisions: "Decisions",
      profiles: "Profiles",
      recipes: "Recipes",
      projects: "Projects",
      compatibilityRules: "Compatibility rules",
      contextVersions: "Instruction versions",
      exports: "Export records",
      importRequests: "Import records",
      auditEvents: "Activity records",
      aiSuggestions: "AI suggestions",
      feedback: "Feedback",
      sessions: "Open sessions",
    },
    failures: {
      invalid_password: "The password is not correct. Nothing was deleted.",
      confirmation_mismatch: "The e-mail you typed does not match your account. Nothing was deleted.",
      billing_provider_unavailable: "Your subscription could not be canceled because the payment provider can't be reached. Nothing was deleted; try again in a few minutes.",
      billing_provider_not_configured: "Your subscription is linked to a payment provider that is not configured on this server, so it can't be canceled automatically. Nothing was deleted; contact support or try again once billing is configured.",
    },
    accountDownloaded: "Your account data was downloaded.",
    exportFailed: "The export could not be downloaded. Try again.",
    accountUnreachable: "The account service can't be reached. Nothing was deleted; try again.",
    title: "Privacy and data",
    leadBefore: "See what your account stores, download all your data, and manage connections and your account. Details are in the ",
    privacyPolicy: "Privacy Policy",
    and: " and ",
    terms: "Terms of Use",
    leadAfter: ".",
    summaryFailed: "The account summary could not be loaded right now. Export and deletion can still be tried; refresh the page to see the counts.",
    storedTitle: "Stored data",
    storedLead: (created: string) => `Your account was opened on ${created}. Every record below belongs only to you and is removed in a single step when the account is deleted.`,
    storedLabel: "Stored record counts",
    aiOnStrong: "Instructions are always compiled deterministically on this server.",
    aiOnText: " AI suggestions are optional; you can turn them on or off below.",
    aiOffStrong: "External AI processing: off.",
    aiOffText: " Instructions are compiled deterministically on this server; no data is sent to an AI provider.",
    textOnly: "URLs, prompts, rules and install commands you import are stored as text only; they are never opened, downloaded or run.",
    contentFree: "The activity log and server logs hold no content, only the type of action, the record id and counts.",
    aiSoonAction: "Allow AI suggestions",
    aiSoonText: "Optional AI suggestions arrive with Pro in V2; the newest AI features come after V3. Until then no data is sent to an AI provider.",
    aiSoonTitle: "AI suggestions",
    downloadTitle: "Download your data",
    downloadLead: "Your account, settings, workspace (portable format), compiled instruction versions, export and activity records in one JSON file. Password hashes, session tokens and provider secrets are never included.",
    preparing: "Preparing…",
    downloadAccount: "Download account data",
    connectionsTitle: "Connections",
    connectionsLead: "External services linked to your account. Deleting the account also cancels a linked subscription with the provider.",
    paymentProvider: "Payment provider",
    testMode: " (test mode)",
    billingLinked: (provider: string | null, plan: string, status: string) => `${provider ?? "provider"} · ${plan} plan · status: ${status}`,
    billingUnlinked: (plan: string) => `No linked subscription · ${plan} plan`,
    billingNotConfigured: "No payment provider is configured on this installation; Free plan.",
    billingUnknown: "The status could not be loaded.",
    manageSubscription: "Manage subscription",
    noOtherServices: "No other external service such as GitHub is linked; this version can't link one.",
    deleteTitle: "Delete account",
    deleteLead: "Permanently deletes your account, all your records and sessions; a linked subscription is canceled with the provider. This can't be undone. We recommend downloading your data first.",
    blockedNote: (attemptedAt: string | null, reason: string) => `The last deletion attempt${attemptedAt ? ` (${attemptedAt})` : ""} stopped at an external step: ${reason} Your account and data were not deleted; you can send the same request again.`,
    noReason: "no reason was recorded.",
    retryDelete: "Retry deletion…",
    deleteAccount: "Delete my account…",
    closeDialog: "Close the deletion dialog",
    cancel: "Cancel",
    deleting: "Deleting…",
    deleteForever: "Permanently delete my account",
    dialogSubtitle: "This can't be undone.",
    dialogTitle: "Permanently delete your account",
    scopeIntro: "The following will be permanently deleted:",
    scopeAccount: (email: string) => `Your account (${email}) and all open sessions`,
    scopeRecords: "Resources, tags, decisions, profiles, recipes and projects",
    scopeHistory: "Compiled instruction versions, export/import and activity records",
    scopeBilling: "A linked subscription is canceled with the provider; only a minimal billing record (provider ids, plan, date) remains",
    confirmEmail: "Type your e-mail address to confirm",
    password: "Your password",
    safetyNote: "Deletion does not start until your password is verified and the subscription is canceled. If a step fails, nothing is deleted and the status is shown here.",
  },
});

const planLabels: Record<string, string> = { free: "Free", pro: "Pro" };

export function PrivacySection({ initial, user, ai, onNotice }: { initial: AccountSummary | null; user: CurrentUser; ai: AiStatus | null; onNotice(text: string, tone?: "ok" | "error"): void }) {
  const locale = useLocale();
  const t = copy[locale];
  const [account, setAccount] = useState(initial);
  const [exporting, setExporting] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletion = account?.deletion ?? null;
  const blocked = deletion?.status === "pending_external";
  const matches = confirmation.trim().toLowerCase() === user.email.toLowerCase();

  async function refresh() {
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (!response.ok) return;
      setAccount(accountSummaryResponseSchema.parse(await response.json()).account);
    } catch {
      // The section keeps its last known state; the next page load refreshes it.
    }
  }

  async function downloadExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) { onNotice((await readApiError(response)).message, "error"); return; }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `devcontext-account-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      onNotice(t.accountDownloaded);
    } catch {
      onNotice(t.exportFailed, "error");
    } finally {
      setExporting(false);
    }
  }

  function openDialog() {
    setConfirmation("");
    setPassword("");
    setError(null);
    setDialog(true);
  }

  async function submitDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || password.length === 0 || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirmation: confirmation.trim() }),
      });
      if (!response.ok) {
        const failure = await readApiError(response);
        const code = failure.details.find((detail) => detail.code in t.failures)?.code;
        setError(code ? t.failures[code]! : failure.message);
        setPassword("");
        await refresh();
        return;
      }
      deleteAccountResponseSchema.parse(await response.json());
      // Full navigation through the absolute origin: the API cleared the session cookie and nothing of the workspace may stay in memory.
      window.location.href = new URL("/auth?mode=sign-in&deleted=1", window.location.origin).toString();
    } catch {
      setError(t.accountUnreachable);
    } finally {
      setPending(false);
    }
  }

  const billing = account?.integrations.billing;
  const planName = billing ? planLabels[billing.plan] ?? billing.plan : "";

  return (
    <section aria-labelledby="settings-privacy-title" className="settings-section" id="settings-privacy">
      <h2 id="settings-privacy-title">{t.title}</h2>
      <p className="lead">{t.leadBefore}<Link className="text-link" href="/legal/privacy">{t.privacyPolicy}</Link>{t.and}<Link className="text-link" href="/legal/terms">{t.terms}</Link>{t.leadAfter}</p>

      {account === null && <p className="note warning" role="status"><Warning aria-hidden size={20} />{t.summaryFailed}</p>}

      <div className="numbered-section">
        <h3>{t.storedTitle}</h3>
        <p>{t.storedLead(account ? formatDateTime(account.createdAt, locale) : "—")}</p>
        {account && (
          <dl aria-label={t.storedLabel} className="stored-grid">
            {storedKeys.map((key) => <div key={key}><dt><small>{t.stored[key]}</small></dt><dd><strong>{account.stored[key]}</strong></dd></div>)}
          </dl>
        )}
        <ul className="disclosure-list">
          {ai?.available
            ? <li><ShieldCheck aria-hidden size={20} /><span><strong>{t.aiOnStrong}</strong>{t.aiOnText}</span></li>
            : <li><ShieldCheck aria-hidden size={20} /><span><strong>{t.aiOffStrong}</strong>{t.aiOffText}</span></li>}
          <li><ShieldCheck aria-hidden size={20} /><span>{t.textOnly}</span></li>
          <li><ShieldCheck aria-hidden size={20} /><span>{t.contentFree}</span></li>
        </ul>
        {ai?.available
          ? <AiConsent initial={ai} onNotice={onNotice} />
          : <AiComingSoon action={t.aiSoonAction} text={t.aiSoonText} title={t.aiSoonTitle} />}
      </div>

      <div className="numbered-section">
        <h3>{t.downloadTitle}</h3>
        <p>{t.downloadLead}</p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="button" disabled={exporting} onClick={() => void downloadExport()} type="button"><DownloadSimple aria-hidden size={20} />{exporting ? t.preparing : t.downloadAccount}</button>
        </div>
      </div>

      <div className="numbered-section">
        <h3>{t.connectionsTitle}</h3>
        <p>{t.connectionsLead}</p>
        <div className="integration-row">
          <span className="mark"><CreditCard aria-hidden size={22} /></span>
          <div className="grow">
            <strong>{t.paymentProvider}{billing?.testMode ? t.testMode : ""}</strong>
            <small>
              {billing
                ? billing.linked
                  ? t.billingLinked(billing.provider, planName, billing.status)
                  : billing.configured ? t.billingUnlinked(planName) : t.billingNotConfigured
                : t.billingUnknown}
            </small>
          </div>
          <Link className="button small" href="/workspace/billing">{t.manageSubscription} <ArrowSquareOut aria-hidden size={16} /></Link>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>{t.noOtherServices}</p>
      </div>

      <div className="danger-zone">
        <h3>{t.deleteTitle}</h3>
        <p>{t.deleteLead}</p>
        {blocked && deletion && (
          <p className="note warning" role="status" style={{ marginTop: 12 }}>
            <Warning aria-hidden size={20} />
            <span>{t.blockedNote(deletion.lastAttemptAt ? formatDateTime(deletion.lastAttemptAt, locale) : null, deletion.lastError ? t.failures[deletion.lastError] ?? deletion.lastError : t.noReason)}</span>
          </p>
        )}
        <div className="actions">
          <button className="button danger" onClick={openDialog} type="button"><Trash aria-hidden size={20} />{blocked ? t.retryDelete : t.deleteAccount}</button>
        </div>
      </div>

      {dialog && (
        <DrawerFrame
          closeLabel={t.closeDialog}
          footer={(
            <>
              <button className="button" disabled={pending} onClick={() => setDialog(false)} type="button">{t.cancel}</button>
              <button className="button danger solid" disabled={!matches || password.length === 0 || pending} type="submit">{pending ? t.deleting : t.deleteForever}</button>
            </>
          )}
          onClose={() => { if (!pending) setDialog(false); }}
          onSubmit={(event) => void submitDeletion(event)}
          subtitle={t.dialogSubtitle}
          title={t.dialogTitle}
          variant="dialog"
        >
          <p>{t.scopeIntro}</p>
          <ul className="scope-list">
            <li>{t.scopeAccount(user.email)}</li>
            <li>{t.scopeRecords}</li>
            <li>{t.scopeHistory}</li>
            <li>{t.scopeBilling}</li>
          </ul>
          <label className="field">
            <span>{t.confirmEmail}</span>
            <input autoComplete="off" data-autofocus onChange={(event) => setConfirmation(event.target.value)} placeholder={user.email} spellCheck={false} type="email" value={confirmation} />
          </label>
          <label className="field">
            <span>{t.password}</span>
            <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="note info" role="note"><CheckCircle aria-hidden size={20} />{t.safetyNote}</p>
        </DrawerFrame>
      )}
    </section>
  );
}
