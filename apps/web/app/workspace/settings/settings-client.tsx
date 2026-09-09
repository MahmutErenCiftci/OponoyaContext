"use client";

import {
  importResponseSchema,
  portableLimits,
  sampleInstallResponseSchema,
  sampleRemoveResponseSchema,
  workspaceSettingsResponseSchema,
  type AccountSummary,
  type CurrentUser,
  type ImportStrategy,
  type ImportSummary,
  type WorkspaceSettings,
} from "@devcontext/contracts";
import { CheckCircle, CreditCard, Database, DownloadSimple, File, Info, Lock, Monitor, Question, ShieldCheck, UploadSimple, User } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
import { ThemeCards } from "../../../components/theme-toggle";
import type { Theme } from "../../../lib/theme";
import { readApiError } from "../../../lib/errors";
import { formatDateTime, pluralCount } from "../../../lib/resource-labels";
import { PrivacySection } from "./privacy-section";

const strategyCopy: Record<ImportStrategy, { label: string; text: string }> = {
  skip: { label: "Mevcutları koru", text: "Mevcut kayıtlar aynen kalır. Yalnızca yeni kayıtlar eklenir." },
  copy: { label: "Kopya oluştur", text: "Çakışan kayıtlar kopyalanır. Yeni sürümler olarak eklenir." },
  replace: { label: "Üzerine yaz", text: "Çakışan kayıtlar içe aktarılan veriyle değiştirilir." },
};

const counterLabels: Array<[keyof ImportSummary["counts"], string]> = [
  ["resources", "Kaynaklar"],
  ["profiles", "Profiller"],
  ["recipes", "Tarifler"],
  ["projects", "Projeler"],
  ["compatibilityRules", "Uyumluluk kuralları"],
];

const sections = [
  { id: "settings-account", label: "Hesap", icon: User },
  { id: "settings-appearance", label: "Görünüm", icon: Monitor },
  { id: "settings-samples", label: "Örnek veriler", icon: Database },
  { id: "import", label: "Veri aktarımı", icon: DownloadSimple },
  { id: "settings-privacy", label: "Gizlilik ve veriler", icon: ShieldCheck },
  { id: "settings-plan", label: "Abonelik", icon: CreditCard },
  { id: "settings-help", label: "Yardım", icon: Question },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MiB`;
}

function ImportSection({ onNotice, onExport, exporting }: { onNotice(text: string): void; onExport(event: MouseEvent<HTMLAnchorElement>): void; exporting: boolean }) {
  const router = useRouter();
  const inputId = useId();
  const [file, setFile] = useState<{ name: string; size: number; modified: number } | null>(null);
  const [document, setDocument] = useState<unknown>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>("skip");
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [state, setState] = useState<"idle" | "previewing" | "importing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  async function preflight(nextDocument: unknown, nextStrategy: ImportStrategy) {
    setState("previewing");
    setError(null);
    setPreview(null);
    try {
      const response = await fetch("/api/workspace/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ document: nextDocument, strategy: nextStrategy, dryRun: true }) });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        setState("idle");
        return;
      }
      setPreview(importResponseSchema.parse(await response.json()).summary);
      setState("idle");
    } catch {
      setError("İçe aktarma hizmetine ulaşılamıyor. Tekrar dene.");
      setState("idle");
    }
  }

  async function chooseFile(next: globalThis.File | undefined) {
    if (!next) return;
    setPreview(null);
    setDocument(null);
    keyRef.current = null;
    setError(null);
    if (next.size > portableLimits.documentBytes) {
      setError("İçe aktarma dosyaları en fazla 32 MiB olabilir.");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await next.text());
      keyRef.current = crypto.randomUUID();
      setFile({ name: next.name, size: next.size, modified: next.lastModified });
      setDocument(parsed);
      setState("idle");
      await preflight(parsed, strategy);
    } catch {
      setError("Bu dosya geçerli bir JSON değil.");
    }
  }

  async function changeStrategy(next: ImportStrategy) {
    setStrategy(next);
    // A strategy change invalidates the previous preview; a new dry run is requested before apply is possible.
    if (document !== null) await preflight(document, next);
  }

  async function apply() {
    if (document === null || !preview?.dryRun) return;
    setState("importing");
    setError(null);
    try {
      const response = await fetch("/api/workspace/import", {
        method: "POST",
        headers: { "content-type": "application/json", ...(keyRef.current ? { "idempotency-key": keyRef.current } : {}) },
        body: JSON.stringify({ document, strategy, dryRun: false }),
      });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        setState("idle");
        return;
      }
      const result = importResponseSchema.parse(await response.json());
      setPreview(result.summary);
      setState("done");
      const written = Object.values(result.summary.counts).reduce((sum, item) => sum + item.create + item.copy + item.replace, 0);
      onNotice(result.created ? `İçe aktarma tamamlandı: ${pluralCount(written, "kayıt")} yazıldı.` : "Bu içe aktarma zaten uygulanmıştı; hiçbir şey değişmedi.");
      router.refresh();
    } catch {
      setError("İçe aktarma hizmetine ulaşılamıyor. Tekrar dene.");
      setState("idle");
    }
  }

  const total = preview ? counterLabels.reduce((sum, [key]) => sum + preview.counts[key].create + preview.counts[key].copy + preview.counts[key].replace, 0) : 0;
  const strategyColumn = strategy === "copy" ? "Kopya" : strategy === "replace" ? "Değiştir" : null;

  return (
    <section aria-labelledby="settings-import" className="settings-section" id="import">
      <div className="section-head">
        <h2 id="settings-import">Veri aktarımı</h2>
        <a aria-disabled={exporting} className="button" download href="/api/workspace/export" onClick={onExport}><UploadSimple aria-hidden size={20} />{exporting ? "Hazırlanıyor…" : "Çalışma alanını dışa aktar"}</a>
      </div>
      <p className="lead">Kütüphaneni, profillerini, tariflerini, projelerini ve kurallarını taşınabilir JSON olarak indir ya da bir yedeği geri yükle. Dosyadaki talimatlar, kurallar ve kurulum komutları yalnızca metin olarak saklanır, asla çalıştırılmaz.</p>

      <div className="numbered-section">
        <h3>1. İçe aktarılacak dosya</h3>
        <p>Desteklenen format: .json (çalışma alanı dışa aktarımları)</p>
        <div className="file-row">
          <File aria-hidden size={28} style={{ color: "var(--muted)" }} />
          <div className="grow">
            {file ? <><strong>{file.name}</strong><small>{formatBytes(file.size)} · {formatDateTime(new Date(file.modified).toISOString())}</small></> : <><strong>Henüz dosya seçilmedi</strong><small>devcontext-export-YYYY-AA-GG.json</small></>}
          </div>
          <label className="text-link locked" htmlFor={inputId} style={{ cursor: "pointer" }}>{file ? "Değiştir" : "Dosya seç"}</label>
          <input accept="application/json,.json" aria-label="İçe aktarılacak dosya" id={inputId} onChange={(event) => void chooseFile(event.target.files?.[0])} type="file" />
        </div>
      </div>

      <div className="numbered-section">
        <h3>2. Mevcut kayıtlar için</h3>
        <p>İçe aktarılan kayıtlarla mevcut kayıtlar çakıştığında ne olacağını seç.</p>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="visually-hidden">Çakışma stratejisi</legend>
          <div className="radio-grid three">
            {(Object.keys(strategyCopy) as ImportStrategy[]).map((option) => (
              <label className={`radio-card tone-success${strategy === option ? " selected" : ""}`} key={option}>
                <input checked={strategy === option} name="import-strategy" onChange={() => void changeStrategy(option)} type="radio" value={option} />
                <strong>{strategyCopy[option].label}</strong>
                <span>{strategyCopy[option].text}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="numbered-section">
        <h3>3. İçe aktarma önizlemesi</h3>
        <p>İçe aktarma yapılmadan önce eklenecek ve atlanacak kayıtların özeti.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {state === "previewing" && <p className="note">Dosya kontrol ediliyor…</p>}
        {!preview && state !== "previewing" && !error && <p className="note">Önizleme için önce bir dosya seç.</p>}
        {preview && (
          <div aria-live="polite">
            <h4 className="visually-hidden">{preview.dryRun ? `Ön kontrol: “${strategyCopy[preview.strategy].label}” ile ${pluralCount(total, "kayıt")} yazılacak` : `İçe aktarıldı: ${pluralCount(total, "kayıt")} yazıldı`}</h4>
            <div className="table-wrap" style={{ marginTop: 0 }}>
              <table aria-label="İçe aktarma önizlemesi" className="table bordered">
                <thead><tr><th scope="col">Tür</th><th scope="col">Yeni</th>{strategyColumn && <th scope="col">{strategyColumn}</th>}<th scope="col">Atlanacak</th></tr></thead>
                <tbody>
                  {counterLabels.map(([key, label]) => (
                    <tr key={key}><th scope="row" style={{ fontWeight: 500 }}>{label}</th><td>{preview.counts[key].create}</td>{strategyColumn && <td>{strategy === "copy" ? preview.counts[key].copy : preview.counts[key].replace}</td>}<td>{preview.counts[key].skip}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.warnings.length > 0 && <ul className="check-list" style={{ marginTop: 12 }}>{preview.warnings.map((warning) => <li className="note warning" key={warning}>{warning}</li>)}</ul>}
            <p className={`note${preview.dryRun ? "" : " success"}`} role="status" style={{ marginTop: 14 }}>
              {preview.dryRun ? <><Info aria-hidden size={20} />Henüz hiçbir kayıt değiştirilmedi.</> : <><CheckCircle aria-hidden size={20} />İçe aktarma tamamlandı. İçe aktarılan projelerin ilk sürümü için talimatlarını oluştur; geçmiş yedeğe dahil değildir.</>}
            </p>
          </div>
        )}
      </div>

      <div className="import-foot">
        <span className="left"><Lock aria-hidden size={18} />Maksimum dosya boyutu: 32 MiB</span>
        <button className="button primary large" disabled={state !== "idle" || !preview?.dryRun || total === 0} onClick={() => void apply()} type="button">{state === "importing" ? "İçe aktarılıyor…" : `${total} kaydı içe aktar`}</button>
      </div>
    </section>
  );
}

export function SettingsClient({ settings: initialSettings, account, theme, user, initialSection }: { settings: WorkspaceSettings | null; account: AccountSummary | null; theme: Theme; user: CurrentUser; initialSection?: string | undefined }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
  const active = clicked ?? (sections.some((section) => section.id === hash) ? hash : initialSection ?? "settings-account");
  const setActive = setClicked;

  async function downloadExport(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (pending !== null) return;
    setPending("export");
    try {
      const response = await fetch("/api/workspace/export");
      if (!response.ok) { setNotice((await readApiError(response)).message); return; }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `devcontext-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setNotice("Dışa aktarma dosyası indirildi.");
    } catch {
      setNotice("Dışa aktarma indirilemedi. Tekrar dene.");
    } finally { setPending(null); }
  }

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 6_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function updateOnboarding(state: WorkspaceSettings["onboardingState"]) {
    setPending("onboarding");
    try {
      const response = await fetch("/api/workspace/onboarding", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) });
      if (!response.ok) {
        setNotice((await readApiError(response)).message);
        return;
      }
      setSettings(workspaceSettingsResponseSchema.parse(await response.json()).settings);
      setNotice(state === "new" ? "Başlangıç rehberi genel bakışta yeniden gösterilecek." : "Kurulum tamamlandı olarak işaretlendi.");
      router.refresh();
    } catch {
      setNotice("Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.");
    } finally {
      setPending(null);
    }
  }

  async function installSamples() {
    setPending("samples");
    try {
      const response = await fetch("/api/workspace/samples", { method: "POST" });
      if (!response.ok) {
        setNotice((await readApiError(response)).message);
        return;
      }
      const result = sampleInstallResponseSchema.parse(await response.json());
      setSettings(result.settings);
      setNotice(result.created ? `Örnek veriler yüklendi: ${result.counts.resources} kaynak, ${result.counts.profiles} profil, ${result.counts.recipes} tarif, ${result.counts.projects} proje.` : "Örnek veriler zaten yüklüydü.");
      router.refresh();
    } catch {
      setNotice("Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.");
    } finally {
      setPending(null);
    }
  }

  async function removeSamples() {
    if (!window.confirm("Örnek kaynaklar, profiller, tarif ve proje (bu örneklerde yaptığın düzenlemelerle birlikte) kaldırılsın mı? Kendi projelerin, profillerin, tariflerin veya kuralların onları kullanıyorsa kaldırma engellenir ve hiçbir şey silinmez.")) return;
    setPending("samples");
    try {
      const response = await fetch("/api/workspace/samples", { method: "DELETE" });
      if (!response.ok) {
        setNotice((await readApiError(response)).message);
        return;
      }
      const result = sampleRemoveResponseSchema.parse(await response.json());
      setSettings(result.settings);
      setNotice(`Örnek veriler kaldırıldı: ${result.removed.resources} kaynak, ${result.removed.profiles} profil, ${result.removed.recipes} tarif, ${result.removed.projects} proje.`);
      router.refresh();
    } catch {
      setNotice("Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.");
    } finally {
      setPending(null);
    }
  }

  const samplesInstalled = Boolean(settings?.sampleVersion);
  const onboardingText = settings
    ? settings.onboardingState === "completed" ? "Kurulum tamamlandı" : settings.onboardingState === "skipped" ? "Başlangıç rehberi atlandı" : settings.onboardingState === "in_progress" ? "Kurulum devam ediyor" : "Başlangıç rehberi gösterilecek"
    : "Kurulum durumu bilinmiyor";

  return (
    <section className="page">
      <h1 className="page-title">Ayarlar</h1>
      {settings === null && <p className="note warning" role="status" style={{ marginTop: 16 }}>Ayarlar yüklenemedi. Çalışma alanı motoru geri gelene kadar aşağıdaki işlemler çalışmayabilir.</p>}
      <div className="settings-layout">
        <nav aria-label="Ayar bölümleri" className="settings-nav">
          {sections.map((section) => <a aria-current={active === section.id ? "true" : undefined} href={`#${section.id}`} key={section.id} onClick={() => setActive(section.id)}><section.icon aria-hidden size={22} />{section.label}</a>)}
        </nav>
        <div className="settings-body">
          <section aria-labelledby="settings-account-title" className="settings-section" id="settings-account">
            <h2 id="settings-account-title">Hesap</h2>
            <p className="lead">Hesap bilgilerin.</p>
            <div aria-label="Hesap bilgileri" className="account-card" role="region">
              <span className="avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}><strong>{user.name}</strong><small>{user.email}</small><small style={{ display: "block", marginTop: 4 }}>{onboardingText}</small></div>
            </div>
            <div className="actions">
              <button className="button" disabled={pending !== null} onClick={() => void updateOnboarding("new")} type="button">Rehberi yeniden göster</button>
              {settings?.onboardingState !== "completed" && <button className="button" disabled={pending !== null} onClick={() => void updateOnboarding("completed")} type="button">Kurulumu tamamla</button>}
            </div>
          </section>

          <section aria-labelledby="settings-appearance-title" className="settings-section" id="settings-appearance">
            <h2 id="settings-appearance-title">Görünüm</h2>
            <p className="lead">Çalışma alanının temasını seç.</p>
            <ThemeCards initialTheme={theme} />
            <p className="note" style={{ marginTop: 18, background: "transparent", padding: 0 }}><Info aria-hidden size={20} />Tercihin bu tarayıcıda hatırlanır.</p>
          </section>

          <section aria-labelledby="settings-samples-title" className="settings-section" id="settings-samples">
            <h2 id="settings-samples-title">Örnek veriler</h2>
            <p className="lead">Örnek yığın, kaynak ve projeleri çalışma alanına yükleyebilirsin. Her örneğin adı “Sample ·” ile başlar; kaldırma yalnızca bu kayıtları siler.</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                {samplesInstalled
                  ? <><p className="status-label ok"><CheckCircle aria-hidden size={20} />Örnekler yüklü</p><p className="muted small" style={{ marginTop: 4 }}>Yüklendi: {settings?.sampleInstalledAt ? formatDateTime(settings.sampleInstalledAt) : `sürüm ${settings?.sampleVersion}`}</p></>
                  : <p className="muted">Örnekler yüklü değil.</p>}
              </div>
              <div className="actions" style={{ marginTop: 0 }}>
                <button className={`button${samplesInstalled ? "" : " primary"}`} disabled={pending !== null || samplesInstalled} onClick={() => void installSamples()} type="button"><Database aria-hidden size={20} />{pending === "samples" && !samplesInstalled ? "Yükleniyor…" : samplesInstalled ? "Örnekler ekli" : "Örnekleri ekle"}</button>
                {samplesInstalled && <button className="button quiet" disabled={pending !== null} onClick={() => void removeSamples()} type="button">{pending === "samples" ? "İşleniyor…" : "Örnekleri kaldır"}</button>}
              </div>
            </div>
          </section>

          <ImportSection exporting={pending === "export"} onExport={(event) => void downloadExport(event)} onNotice={setNotice} />

          <PrivacySection initial={account} onNotice={setNotice} user={user} />

          <section aria-labelledby="settings-plan-title" className="settings-section" id="settings-plan">
            <h2 id="settings-plan-title">Abonelik</h2>
            <p className="lead">Planını ve kullanımını gör, aboneliğini yönet. Planın sona erdiğinde kayıtların korunur.</p>
            <Link className="button" href="/workspace/billing"><CreditCard aria-hidden size={20} />Aboneliği aç</Link>
          </section>

          <section aria-labelledby="settings-help-title" className="settings-section" id="settings-help">
            <h2 id="settings-help-title">Yardım</h2>
            <p className="lead">DevContext nasıl çalışır?</p>
            <dl style={{ display: "grid", gap: 16 }}>
              <div><dt style={{ fontWeight: 600 }}>Ortak proje bağlamı</dt><dd className="muted">Talimat oluşturma; Kütüphane kurallarını, bağlı profilleri, uygulanan tarifi ve proje kararlarını tek deterministik JSON nesnesinde birleştirir. Her dışa aktarma hedefi (genel talimat, AGENTS.md, CLAUDE.md, Cursor, Copilot) bu nesneden üretilir; öncelik Proje › Tarif › Profil › Kütüphane kuralıdır.</dd></div>
              <div><dt style={{ fontWeight: 600 }}>Sürüm geçmişi</dt><dd className="muted">Yalnızca içerik değiştiğinde yeni sürüm kaydedilir. Her sürüm derleyici sürümünü ve içerik özetini taşır; eski sürümler okunabilir kalır ve sürüm karşılaştırması iki sürüm arasında neyin değiştiğini açıklar.</dd></div>
              <div><dt style={{ fontWeight: 600 }}>Dört karar biçimi</dt><dd className="muted"><strong>Kilitli:</strong> AI bu seçimi değiştirmesin. <strong>Tercih edilen:</strong> varsayılan; gerekçeyle alternatif seçilebilir. <strong>AI karar versin:</strong> kısıtlar içinde seçimi AI yapar, sabit kaynak yok. <strong>Devre dışı:</strong> bu kaynak bu kapsamda kullanılmasın.</dd></div>
              <div><dt style={{ fontWeight: 600 }}>Uyarılar</dt><dd className="muted">Arşivlenmiş kaynaklar, çakışmalar ve uyumluluk kuralları uyarı üretir. Bir sorunu açıklar, kararını senin yerine değiştirmez.</dd></div>
            </dl>
          </section>
        </div>
      </div>
      {notice && <div className="toast" role="status"><span className="status-label ok"><CheckCircle aria-hidden size={18} />{notice}</span></div>}
    </section>
  );
}
