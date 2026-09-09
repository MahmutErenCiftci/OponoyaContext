"use client";

import { accountSummaryResponseSchema, deleteAccountResponseSchema, type AccountSummary, type CurrentUser } from "@devcontext/contracts";
import { ArrowSquareOut, CheckCircle, CreditCard, DownloadSimple, ShieldCheck, Trash, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DrawerFrame } from "../../../components/drawer";
import { readApiError } from "../../../lib/errors";
import { formatDateTime } from "../../../lib/resource-labels";

const storedLabels: Array<[keyof AccountSummary["stored"], string]> = [
  ["resources", "Kaynak"],
  ["tags", "Etiket"],
  ["decisions", "Karar"],
  ["profiles", "Profil"],
  ["recipes", "Tarif"],
  ["projects", "Proje"],
  ["compatibilityRules", "Uyumluluk kuralı"],
  ["contextVersions", "Talimat sürümü"],
  ["exports", "Dışa aktarma kaydı"],
  ["importRequests", "İçe aktarma kaydı"],
  ["auditEvents", "Etkinlik kaydı"],
  ["sessions", "Açık oturum"],
];

/** Turkish copy for the content-free codes the API returns; anything else falls back to the API message. */
const failureText: Record<string, string> = {
  invalid_password: "Şifre doğru değil. Hiçbir şey silinmedi.",
  confirmation_mismatch: "Yazdığın e-posta hesabınla eşleşmiyor. Hiçbir şey silinmedi.",
  billing_provider_unavailable: "Ödeme sağlayıcısına ulaşılamadığı için aboneliğin iptal edilemedi. Hiçbir şey silinmedi; birkaç dakika sonra yeniden dene.",
  billing_provider_not_configured: "Aboneliğin bu sunucuda yapılandırılmamış bir ödeme sağlayıcısına bağlı, bu yüzden otomatik iptal edilemiyor. Hiçbir şey silinmedi; destekle iletişime geç ya da faturalama yapılandırıldığında yeniden dene.",
};

const planLabels: Record<string, string> = { free: "Free", pro: "Pro" };

export function PrivacySection({ initial, user, onNotice }: { initial: AccountSummary | null; user: CurrentUser; onNotice(text: string): void }) {
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
      if (!response.ok) { onNotice((await readApiError(response)).message); return; }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `devcontext-account-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      onNotice("Hesap verilerin indirildi.");
    } catch {
      onNotice("Dışa aktarma indirilemedi. Tekrar dene.");
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
        const code = failure.details.find((detail) => detail.code in failureText)?.code;
        setError(code ? failureText[code]! : failure.message);
        setPassword("");
        await refresh();
        return;
      }
      deleteAccountResponseSchema.parse(await response.json());
      // Full navigation through the absolute origin: the API cleared the session cookie and nothing of the workspace may stay in memory.
      window.location.href = new URL("/auth?mode=sign-in&deleted=1", window.location.origin).toString();
    } catch {
      setError("Hesap hizmetine ulaşılamıyor. Hiçbir şey silinmedi; tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="settings-privacy-title" className="settings-section" id="settings-privacy">
      <h2 id="settings-privacy-title">Gizlilik ve veriler</h2>
      <p className="lead">Hesabında ne saklandığını gör, tüm verini indir, bağlantıları ve hesabını yönet. Ayrıntılar <Link className="text-link" href="/legal/privacy">Gizlilik Politikası</Link> ve <Link className="text-link" href="/legal/terms">Kullanım Şartları</Link>’nda.</p>

      {account === null && <p className="note warning" role="status"><Warning aria-hidden size={20} />Hesap özeti şu an yüklenemedi. Dışa aktarma ve silme yine denenebilir; sayıları görmek için sayfayı yenile.</p>}

      <div className="numbered-section">
        <h3>Saklanan veriler</h3>
        <p>Hesabın {account ? formatDateTime(account.createdAt) : "—"} tarihinde açıldı. Aşağıdaki her kayıt yalnızca sana aittir ve hesap silindiğinde tek işlemde kaldırılır.</p>
        {account && (
          <dl aria-label="Saklanan kayıt sayıları" className="stored-grid">
            {storedLabels.map(([key, label]) => <div key={key}><dt><small>{label}</small></dt><dd><strong>{account.stored[key]}</strong></dd></div>)}
          </dl>
        )}
        <ul className="disclosure-list">
          <li><ShieldCheck aria-hidden size={20} /><span><strong>Dış yapay zekâ işleme: kapalı.</strong> Talimatlar bu sunucuda deterministik olarak derlenir; hiçbir veri bir AI sağlayıcısına gönderilmez.</span></li>
          <li><ShieldCheck aria-hidden size={20} /><span>İçe aktardığın URL’ler, promptlar, kurallar ve kurulum komutları yalnızca metin olarak saklanır; asla açılmaz, indirilmez ya da çalıştırılmaz.</span></li>
          <li><ShieldCheck aria-hidden size={20} /><span>Etkinlik kaydı ve sunucu günlükleri içerik değil, yalnızca işlem türü, kayıt kimliği ve sayı tutar.</span></li>
        </ul>
      </div>

      <div className="numbered-section">
        <h3>Verini indir</h3>
        <p>Hesap, ayarlar, çalışma alanı (taşınabilir biçim), derlenmiş talimat sürümleri, dışa aktarma ve etkinlik kayıtları tek JSON dosyasında. Şifre özeti, oturum belirteci veya sağlayıcı sırları hiçbir zaman dahil değildir.</p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="button" disabled={exporting} onClick={() => void downloadExport()} type="button"><DownloadSimple aria-hidden size={20} />{exporting ? "Hazırlanıyor…" : "Hesap verilerini indir"}</button>
        </div>
      </div>

      <div className="numbered-section">
        <h3>Bağlantılar</h3>
        <p>Hesabına bağlı dış hizmetler. Silme, bağlı aboneliği sağlayıcıda da iptal eder.</p>
        <div className="integration-row">
          <span className="mark"><CreditCard aria-hidden size={22} /></span>
          <div className="grow">
            <strong>Ödeme sağlayıcısı{account?.integrations.billing.testMode ? " (test modu)" : ""}</strong>
            <small>
              {account
                ? account.integrations.billing.linked
                  ? `${account.integrations.billing.provider ?? "sağlayıcı"} · ${planLabels[account.integrations.billing.plan] ?? account.integrations.billing.plan} planı · durum: ${account.integrations.billing.status}`
                  : account.integrations.billing.configured ? `Bağlı abonelik yok · ${planLabels[account.integrations.billing.plan] ?? account.integrations.billing.plan} planı` : "Bu kurulumda ödeme sağlayıcısı yapılandırılmadı; Free plan."
                : "Durum yüklenemedi."}
            </small>
          </div>
          <Link className="button small" href="/workspace/billing">Aboneliği yönet <ArrowSquareOut aria-hidden size={16} /></Link>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>Başka dış entegrasyon yok: GitHub, AI sağlayıcısı veya başka bir hizmet bağlı değil; bu sürümde bağlanamaz.</p>
      </div>

      <div className="danger-zone">
        <h3>Hesabı sil</h3>
        <p>Hesabını, tüm kayıtlarını ve oturumlarını kalıcı olarak siler; bağlı abonelik sağlayıcıda iptal edilir. Geri alınamaz. Silmeden önce verini indirmeni öneririz.</p>
        {blocked && deletion && (
          <p className="note warning" role="status" style={{ marginTop: 12 }}>
            <Warning aria-hidden size={20} />
            <span>Son silme denemesi{deletion.lastAttemptAt ? ` (${formatDateTime(deletion.lastAttemptAt)})` : ""} dış adımda durdu: {deletion.lastError ? failureText[deletion.lastError] ?? deletion.lastError : "sebep kaydedilmedi"} Hesabın ve verilerin silinmedi; aynı isteği yeniden gönderebilirsin.</span>
          </p>
        )}
        <div className="actions">
          <button className="button danger" onClick={openDialog} type="button"><Trash aria-hidden size={20} />{blocked ? "Silmeyi yeniden dene…" : "Hesabımı sil…"}</button>
        </div>
      </div>

      {dialog && (
        <DrawerFrame
          closeLabel="Silme penceresini kapat"
          footer={(
            <>
              <button className="button" disabled={pending} onClick={() => setDialog(false)} type="button">Vazgeç</button>
              <button className="button danger solid" disabled={!matches || password.length === 0 || pending} type="submit">{pending ? "Siliniyor…" : "Hesabımı kalıcı olarak sil"}</button>
            </>
          )}
          onClose={() => { if (!pending) setDialog(false); }}
          onSubmit={(event) => void submitDeletion(event)}
          subtitle="Bu işlem geri alınamaz."
          title="Hesabını kalıcı olarak sil"
          variant="dialog"
        >
          <p>Şunlar kalıcı olarak silinecek:</p>
          <ul className="scope-list">
            <li>Hesabın ({user.email}) ve tüm açık oturumların</li>
            <li>Kaynaklar, etiketler, kararlar, profiller, tarifler ve projeler</li>
            <li>Derlenmiş talimat sürümleri, dışa/içe aktarma ve etkinlik kayıtları</li>
            <li>Bağlı abonelik sağlayıcıda iptal edilir; yalnızca asgari fatura kaydı (sağlayıcı kimlikleri, plan, tarih) kalır</li>
          </ul>
          <label className="field">
            <span>Onaylamak için e-posta adresini yaz</span>
            <input autoComplete="off" data-autofocus onChange={(event) => setConfirmation(event.target.value)} placeholder={user.email} spellCheck={false} type="email" value={confirmation} />
          </label>
          <label className="field">
            <span>Şifren</span>
            <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="note info" role="note"><CheckCircle aria-hidden size={20} />Silme, şifren doğrulanmadan ve abonelik iptali tamamlanmadan başlamaz. Bir adım başarısız olursa hiçbir şey silinmez ve durum burada gösterilir.</p>
        </DrawerFrame>
      )}
    </section>
  );
}
