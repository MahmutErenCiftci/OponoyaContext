"use client";

import {
  importResponseSchema,
  productName,
  portableLimits,
  sampleInstallResponseSchema,
  sampleRemoveResponseSchema,
  workspaceSettingsResponseSchema,
  type AccountSummary,
  type AiStatus,
  type CurrentUser,
  type ImportStrategy,
  type ImportSummary,
  type WorkspaceSettings,
} from "@devcontext/contracts";
import { CheckCircle, ClockCounterClockwise, CreditCard, Database, DownloadSimple, File, Info, Lock, Monitor, Question, ShieldCheck, UploadSimple, User, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState, useSyncExternalStore, useTransition, type MouseEvent, type ReactNode } from "react";

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
import { useLocale } from "../../../components/locale-provider";
import { ThemeCards } from "../../../components/theme-toggle";
import type { Theme } from "../../../lib/theme";
import { readApiError } from "../../../lib/errors";
import { defineCopy, localeCookie, localeNames, locales, type Locale } from "../../../lib/i18n";
import { formatDateTime, pluralCount } from "../../../lib/resource-labels";
import { PasswordForm } from "./password-form";
import { PrivacySection } from "./privacy-section";

/** A toast is either a confirmation or a failure; failures are announced as alerts and never wear the success check. */
type Notice = { text: string; tone: "ok" | "error" };
type Notify = (text: string, tone?: Notice["tone"]) => void;

type SampleCounts = { resources: number; profiles: number; recipes: number; projects: number };
type SectionKey = "account" | "activity" | "appearance" | "samples" | "import" | "privacy" | "plan" | "help";

const copy = defineCopy({
  tr: {
    strategies: {
      skip: { label: "Mevcutları koru", text: "Mevcut kayıtlar aynen kalır. Yalnızca yeni kayıtlar eklenir." },
      copy: { label: "Kopya oluştur", text: "Çakışan kayıtlar kopyalanır. Yeni sürümler olarak eklenir." },
      replace: { label: "Üzerine yaz", text: "Çakışan kayıtlar içe aktarılan veriyle değiştirilir." },
    } satisfies Record<ImportStrategy, { label: string; text: string }>,
    counters: {
      resources: "Kaynaklar",
      profiles: "Profiller",
      recipes: "Tarifler",
      projects: "Projeler",
      compatibilityRules: "Uyumluluk kuralları",
    },
    sections: {
      account: "Hesap",
      activity: "Etkinlik geçmişi",
      appearance: "Görünüm",
      samples: "Örnek veriler",
      import: "Veri aktarımı",
      privacy: "Gizlilik ve veriler",
      plan: "Abonelik",
      help: "Yardım",
    } satisfies Record<SectionKey, string>,
    decimal: ",",
    records: (count: number) => pluralCount(count, "kayıt"),
    importUnreachable: "İçe aktarma hizmetine ulaşılamıyor. Tekrar dene.",
    fileTooLarge: "İçe aktarma dosyaları en fazla 32 MiB olabilir.",
    invalidJson: "Bu dosya geçerli bir JSON değil.",
    importDone: (records: string) => `İçe aktarma tamamlandı: ${records} yazıldı.`,
    importRepeated: "Bu içe aktarma zaten uygulanmıştı; hiçbir şey değişmedi.",
    columnCopy: "Kopya",
    columnReplace: "Değiştir",
    preparing: "Hazırlanıyor…",
    exportWorkspace: "Çalışma alanını dışa aktar",
    importLead: "Kütüphaneni, profillerini, tariflerini, projelerini ve kurallarını taşınabilir JSON olarak indir ya da bir yedeği geri yükle. Dosyadaki talimatlar, kurallar ve kurulum komutları yalnızca metin olarak saklanır, asla çalıştırılmaz.",
    stepFile: "1. İçe aktarılacak dosya",
    supportedFormat: "Desteklenen format: .json (çalışma alanı dışa aktarımları)",
    noFile: "Henüz dosya seçilmedi",
    filePattern: "devcontext-export-YYYY-AA-GG.json",
    changeFile: "Değiştir",
    chooseFile: "Dosya seç",
    fileInput: "İçe aktarılacak dosya",
    stepStrategy: "2. Mevcut kayıtlar için",
    stepStrategyLead: "İçe aktarılan kayıtlarla mevcut kayıtlar çakıştığında ne olacağını seç.",
    strategyLegend: "Çakışma stratejisi",
    stepPreview: "3. İçe aktarma önizlemesi",
    stepPreviewLead: "İçe aktarma yapılmadan önce eklenecek ve atlanacak kayıtların özeti.",
    checkingFile: "Dosya kontrol ediliyor…",
    chooseFileFirst: "Önizleme için önce bir dosya seç.",
    previewDryRun: (strategy: string, records: string) => `Ön kontrol: “${strategy}” ile ${records} yazılacak`,
    previewImported: (records: string) => `İçe aktarıldı: ${records} yazıldı`,
    previewTable: "İçe aktarma önizlemesi",
    columnType: "Tür",
    columnNew: "Yeni",
    columnSkip: "Atlanacak",
    nothingChanged: "Henüz hiçbir kayıt değiştirilmedi.",
    importedNote: "İçe aktarma tamamlandı. İçe aktarılan projelerin ilk sürümü için talimatlarını oluştur; geçmiş yedeğe dahil değildir.",
    maxSize: "Maksimum dosya boyutu: 32 MiB",
    importing: "İçe aktarılıyor…",
    importCount: (count: number) => `${count} kaydı içe aktar`,
    exportDownloaded: "Dışa aktarma dosyası indirildi.",
    exportFailed: "Dışa aktarma indirilemedi. Tekrar dene.",
    guideReset: "Başlangıç rehberi genel bakışta yeniden gösterilecek.",
    setupMarked: "Kurulum tamamlandı olarak işaretlendi.",
    workspaceUnreachable: "Çalışma alanına ulaşılamıyor. Lütfen tekrar dene.",
    samplesInstalledNotice: (counts: SampleCounts) => `Örnek veriler yüklendi: ${counts.resources} kaynak, ${counts.profiles} profil, ${counts.recipes} tarif, ${counts.projects} proje.`,
    samplesAlready: "Örnek veriler zaten yüklüydü.",
    removeConfirm: "Örnek kaynaklar, profiller, tarif ve proje (bu örneklerde yaptığın düzenlemelerle birlikte) kaldırılsın mı? Kendi projelerin, profillerin, tariflerin veya kuralların onları kullanıyorsa kaldırma engellenir ve hiçbir şey silinmez.",
    samplesRemovedNotice: (counts: SampleCounts) => `Örnek veriler kaldırıldı: ${counts.resources} kaynak, ${counts.profiles} profil, ${counts.recipes} tarif, ${counts.projects} proje.`,
    onboarding: {
      completed: "Kurulum tamamlandı",
      skipped: "Başlangıç rehberi atlandı",
      in_progress: "Kurulum devam ediyor",
      new: "Başlangıç rehberi gösterilecek",
    } satisfies Record<WorkspaceSettings["onboardingState"], string>,
    onboardingUnknown: "Kurulum durumu bilinmiyor",
    title: "Ayarlar",
    settingsFailed: "Ayarlar yüklenemedi. Çalışma alanı motoru geri gelene kadar aşağıdaki işlemler çalışmayabilir.",
    sectionNav: "Ayar bölümleri",
    accountLead: "Hesap bilgilerin ve giriş güvenliğin.",
    accountDetails: "Hesap bilgileri",
    showGuide: "Rehberi yeniden göster",
    completeSetup: "Kurulumu tamamla",
    activityLead: "Çalışma alanında yaptığın son değişiklikler. Kayıtlar yalnızca işlem türünü tutar; adlar ve içerikler yazılmaz.",
    appearanceLead: "Çalışma alanının temasını seç.",
    languageTitle: "Dil",
    languageLead: "Arayüz dilini seç.",
    languageHints: { tr: "Türkçe arayüz", en: "İngilizce arayüz" } satisfies Record<Locale, string>,
    rememberedNote: "Tercihin bu tarayıcıda hatırlanır.",
    samplesLead: "Örnek yığın, kaynak ve projeleri çalışma alanına yükleyebilirsin. Her örneğin adı “Sample ·” ile başlar; kaldırma yalnızca bu kayıtları siler.",
    samplesPresent: "Örnekler yüklü",
    installedAt: (when: string) => `Yüklendi: ${when}`,
    sampleVersion: (version: string | null | undefined) => `sürüm ${version}`,
    samplesAbsent: "Örnekler yüklü değil.",
    installing: "Yükleniyor…",
    samplesAdded: "Örnekler ekli",
    addSamples: "Örnekleri ekle",
    processing: "İşleniyor…",
    removeSamples: "Örnekleri kaldır",
    planLead: "Planını ve kullanımını gör, aboneliğini yönet. Planın sona erdiğinde kayıtların korunur.",
    openPlan: "Aboneliği aç",
    helpLead: (name: string) => `${name} nasıl çalışır?`,
    helpContextTerm: "Ortak proje bağlamı",
    helpContextText: "Talimat oluşturma; Kütüphane kurallarını, bağlı profilleri, uygulanan tarifi ve proje kararlarını tek deterministik JSON nesnesinde birleştirir. Her dışa aktarma hedefi (genel talimat, AGENTS.md, CLAUDE.md, Cursor, Copilot) bu nesneden üretilir; öncelik Proje › Tarif › Profil › Kütüphane kuralıdır.",
    helpHistoryTerm: "Sürüm geçmişi",
    helpHistoryText: "Yalnızca içerik değiştiğinde yeni sürüm kaydedilir. Her sürüm derleyici sürümünü ve içerik özetini taşır; eski sürümler okunabilir kalır ve sürüm karşılaştırması iki sürüm arasında neyin değiştiğini açıklar.",
    helpModesTerm: "Dört karar biçimi",
    helpModes: [
      ["Kilitli:", "AI bu seçimi değiştirmesin."],
      ["Tercih edilen:", "varsayılan; gerekçeyle alternatif seçilebilir."],
      ["AI karar versin:", "kısıtlar içinde seçimi AI yapar, sabit kaynak yok."],
      ["Devre dışı:", "bu kaynak bu kapsamda kullanılmasın."],
    ] as Array<[string, string]>,
    helpWarningsTerm: "Uyarılar",
    helpWarningsText: "Arşivlenmiş kaynaklar, çakışmalar ve uyumluluk kuralları uyarı üretir. Bir sorunu açıklar, kararını senin yerine değiştirmez.",
  },
  en: {
    strategies: {
      skip: { label: "Keep existing", text: "Existing records stay as they are. Only new records are added." },
      copy: { label: "Create a copy", text: "Conflicting records are copied and added as new versions." },
      replace: { label: "Overwrite", text: "Conflicting records are replaced with the imported data." },
    },
    counters: {
      resources: "Resources",
      profiles: "Profiles",
      recipes: "Recipes",
      projects: "Projects",
      compatibilityRules: "Compatibility rules",
    },
    sections: {
      account: "Account",
      activity: "Activity history",
      appearance: "Appearance",
      samples: "Sample data",
      import: "Import and export",
      privacy: "Privacy and data",
      plan: "Subscription",
      help: "Help",
    },
    decimal: ".",
    records: (count: number) => pluralCount(count, "record", "records"),
    importUnreachable: "The import service can't be reached. Try again.",
    fileTooLarge: "Import files can be at most 32 MiB.",
    invalidJson: "This file is not valid JSON.",
    importDone: (records: string) => `Import complete: ${records} written.`,
    importRepeated: "This import was already applied; nothing changed.",
    columnCopy: "Copy",
    columnReplace: "Replace",
    preparing: "Preparing…",
    exportWorkspace: "Export workspace",
    importLead: "Download your Library, profiles, recipes, projects and rules as portable JSON, or restore a backup. Instructions, rules and install commands in the file are stored as text only and never run.",
    stepFile: "1. File to import",
    supportedFormat: "Supported format: .json (workspace exports)",
    noFile: "No file selected yet",
    filePattern: "devcontext-export-YYYY-MM-DD.json",
    changeFile: "Change",
    chooseFile: "Choose file",
    fileInput: "File to import",
    stepStrategy: "2. For existing records",
    stepStrategyLead: "Choose what happens when imported records conflict with existing ones.",
    strategyLegend: "Conflict strategy",
    stepPreview: "3. Import preview",
    stepPreviewLead: "A summary of the records that will be added and skipped, before anything is imported.",
    checkingFile: "Checking the file…",
    chooseFileFirst: "Choose a file to see a preview.",
    previewDryRun: (strategy: string, records: string) => `Dry run: “${strategy}” will write ${records}`,
    previewImported: (records: string) => `Imported: ${records} written`,
    previewTable: "Import preview",
    columnType: "Type",
    columnNew: "New",
    columnSkip: "Skipped",
    nothingChanged: "No records have been changed yet.",
    importedNote: "Import complete. Generate instructions for the first version of each imported project; history is not part of the backup.",
    maxSize: "Maximum file size: 32 MiB",
    importing: "Importing…",
    importCount: (count: number) => `Import ${count} ${count === 1 ? "record" : "records"}`,
    exportDownloaded: "The export file was downloaded.",
    exportFailed: "The export could not be downloaded. Try again.",
    guideReset: "The getting-started guide will show on the overview again.",
    setupMarked: "Setup marked as complete.",
    workspaceUnreachable: "The workspace can't be reached. Please try again.",
    samplesInstalledNotice: (counts: SampleCounts) => `Sample data installed: ${pluralCount(counts.resources, "resource", "resources")}, ${pluralCount(counts.profiles, "profile", "profiles")}, ${pluralCount(counts.recipes, "recipe", "recipes")}, ${pluralCount(counts.projects, "project", "projects")}.`,
    samplesAlready: "The sample data was already installed.",
    removeConfirm: "Remove the sample resources, profiles, recipe and project (including the edits you made to them)? If your own projects, profiles, recipes or rules use them, the removal is blocked and nothing is deleted.",
    samplesRemovedNotice: (counts: SampleCounts) => `Sample data removed: ${pluralCount(counts.resources, "resource", "resources")}, ${pluralCount(counts.profiles, "profile", "profiles")}, ${pluralCount(counts.recipes, "recipe", "recipes")}, ${pluralCount(counts.projects, "project", "projects")}.`,
    onboarding: {
      completed: "Setup complete",
      skipped: "Getting-started guide skipped",
      in_progress: "Setup in progress",
      new: "The getting-started guide will be shown",
    },
    onboardingUnknown: "Setup state unknown",
    title: "Settings",
    settingsFailed: "Settings could not be loaded. The actions below may not work until the workspace engine is back.",
    sectionNav: "Settings sections",
    accountLead: "Your account details and sign-in security.",
    accountDetails: "Account details",
    showGuide: "Show the guide again",
    completeSetup: "Complete setup",
    activityLead: "Your latest changes in the workspace. Entries record only the type of action; names and content are never written.",
    appearanceLead: "Choose the workspace theme.",
    languageTitle: "Language",
    languageLead: "Choose the interface language.",
    languageHints: { tr: "Turkish interface", en: "English interface" },
    rememberedNote: "Your choice is remembered in this browser.",
    samplesLead: "You can load a sample stack, resources and projects into your workspace. Every sample's name starts with “Sample ·”; removing them deletes only these records.",
    samplesPresent: "Samples installed",
    installedAt: (when: string) => `Installed: ${when}`,
    sampleVersion: (version: string | null | undefined) => `version ${version}`,
    samplesAbsent: "Samples are not installed.",
    installing: "Installing…",
    samplesAdded: "Samples added",
    addSamples: "Add samples",
    processing: "Working…",
    removeSamples: "Remove samples",
    planLead: "See your plan and usage, and manage your subscription. Your records are kept when your plan ends.",
    openPlan: "Open subscription",
    helpLead: (name: string) => `How does ${name} work?`,
    helpContextTerm: "Shared project context",
    helpContextText: "Generating instructions merges Library rules, linked profiles, the applied recipe and project decisions into one deterministic JSON object. Every export target (general instructions, AGENTS.md, CLAUDE.md, Cursor, Copilot) is produced from this object; precedence is Project › Recipe › Profile › Library rule.",
    helpHistoryTerm: "Version history",
    helpHistoryText: "A new version is saved only when the content changes. Each version carries the compiler version and a content hash; older versions stay readable, and the version comparison explains what changed between two versions.",
    helpModesTerm: "Four decision modes",
    helpModes: [
      ["Locked:", "AI must not change this choice."],
      ["Preferred:", "the default; an alternative can be chosen with a reason."],
      ["Let AI decide:", "AI makes the choice within the constraints; no fixed resource."],
      ["Disabled:", "this resource must not be used in this scope."],
    ],
    helpWarningsTerm: "Warnings",
    helpWarningsText: "Archived resources, conflicts and compatibility rules produce warnings. A warning explains a problem; it never changes your decision for you.",
  },
});

type Copy = (typeof copy)[Locale];

const counterKeys: Array<keyof ImportSummary["counts"]> = ["resources", "profiles", "recipes", "projects", "compatibilityRules"];

const sections: Array<{ id: string; key: SectionKey; icon: typeof User }> = [
  { id: "settings-account", key: "account", icon: User },
  { id: "settings-activity", key: "activity", icon: ClockCounterClockwise },
  { id: "settings-appearance", key: "appearance", icon: Monitor },
  { id: "settings-samples", key: "samples", icon: Database },
  { id: "import", key: "import", icon: DownloadSimple },
  { id: "settings-privacy", key: "privacy", icon: ShieldCheck },
  { id: "settings-plan", key: "plan", icon: CreditCard },
  { id: "settings-help", key: "help", icon: Question },
];

function formatBytes(bytes: number, t: Copy) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", t.decimal)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", t.decimal)} MiB`;
}

function ImportSection({ onNotice, onExport, exporting }: { onNotice: Notify; onExport(event: MouseEvent<HTMLAnchorElement>): void; exporting: boolean }) {
  const router = useRouter();
  const locale = useLocale();
  const t = copy[locale];
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
      setError(t.importUnreachable);
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
      setError(t.fileTooLarge);
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
      setError(t.invalidJson);
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
      onNotice(result.created ? t.importDone(t.records(written)) : t.importRepeated);
      router.refresh();
    } catch {
      setError(t.importUnreachable);
      setState("idle");
    }
  }

  const total = preview ? counterKeys.reduce((sum, key) => sum + preview.counts[key].create + preview.counts[key].copy + preview.counts[key].replace, 0) : 0;
  const strategyColumn = strategy === "copy" ? t.columnCopy : strategy === "replace" ? t.columnReplace : null;

  return (
    <section aria-labelledby="settings-import" className="settings-section" id="import">
      <div className="section-head">
        <h2 id="settings-import">{t.sections.import}</h2>
        <a aria-disabled={exporting} className="button" download href="/api/workspace/export" onClick={onExport}><UploadSimple aria-hidden size={20} />{exporting ? t.preparing : t.exportWorkspace}</a>
      </div>
      <p className="lead">{t.importLead}</p>

      <div className="numbered-section">
        <h3>{t.stepFile}</h3>
        <p>{t.supportedFormat}</p>
        <div className="file-row">
          <File aria-hidden size={28} style={{ color: "var(--muted)" }} />
          <div className="grow">
            {file ? <><strong>{file.name}</strong><small>{formatBytes(file.size, t)} · {formatDateTime(new Date(file.modified).toISOString(), locale)}</small></> : <><strong>{t.noFile}</strong><small>{t.filePattern}</small></>}
          </div>
          <label className="text-link locked" htmlFor={inputId} style={{ cursor: "pointer" }}>{file ? t.changeFile : t.chooseFile}</label>
          <input accept="application/json,.json" aria-label={t.fileInput} id={inputId} onChange={(event) => void chooseFile(event.target.files?.[0])} type="file" />
        </div>
      </div>

      <div className="numbered-section">
        <h3>{t.stepStrategy}</h3>
        <p>{t.stepStrategyLead}</p>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="visually-hidden">{t.strategyLegend}</legend>
          <div className="radio-grid three">
            {(Object.keys(t.strategies) as ImportStrategy[]).map((option) => (
              <label className={`radio-card tone-success${strategy === option ? " selected" : ""}`} key={option}>
                <input checked={strategy === option} name="import-strategy" onChange={() => void changeStrategy(option)} type="radio" value={option} />
                <strong>{t.strategies[option].label}</strong>
                <span>{t.strategies[option].text}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="numbered-section">
        <h3>{t.stepPreview}</h3>
        <p>{t.stepPreviewLead}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {state === "previewing" && <p className="note">{t.checkingFile}</p>}
        {!preview && state !== "previewing" && !error && <p className="note">{t.chooseFileFirst}</p>}
        {preview && (
          <div aria-live="polite">
            <h4 className="visually-hidden">{preview.dryRun ? t.previewDryRun(t.strategies[preview.strategy].label, t.records(total)) : t.previewImported(t.records(total))}</h4>
            <div className="table-wrap" style={{ marginTop: 0 }}>
              <table aria-label={t.previewTable} className="table bordered">
                <thead><tr><th scope="col">{t.columnType}</th><th scope="col">{t.columnNew}</th>{strategyColumn && <th scope="col">{strategyColumn}</th>}<th scope="col">{t.columnSkip}</th></tr></thead>
                <tbody>
                  {counterKeys.map((key) => (
                    <tr key={key}><th scope="row" style={{ fontWeight: 500 }}>{t.counters[key]}</th><td>{preview.counts[key].create}</td>{strategyColumn && <td>{strategy === "copy" ? preview.counts[key].copy : preview.counts[key].replace}</td>}<td>{preview.counts[key].skip}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.warnings.length > 0 && <ul className="check-list" style={{ marginTop: 12 }}>{preview.warnings.map((warning) => <li className="note warning" key={warning}>{warning}</li>)}</ul>}
            <p className={`note${preview.dryRun ? "" : " success"}`} role="status" style={{ marginTop: 14 }}>
              {preview.dryRun ? <><Info aria-hidden size={20} />{t.nothingChanged}</> : <><CheckCircle aria-hidden size={20} />{t.importedNote}</>}
            </p>
          </div>
        )}
      </div>

      <div className="import-foot">
        <span className="left"><Lock aria-hidden size={18} />{t.maxSize}</span>
        <button className="button primary large" disabled={state !== "idle" || !preview?.dryRun || total === 0} onClick={() => void apply()} type="button">{state === "importing" ? t.importing : t.importCount(total)}</button>
      </div>
    </section>
  );
}

function persistLocale(next: Locale) {
  document.cookie = localeCookie(next);
}

/**
 * Interface language: the same cookie as the top-bar switch, then a refresh
 * so the server renders the page in the new language. The choice shows
 * immediately while the refresh runs.
 */
function LanguageChoice() {
  const locale = useLocale();
  const t = copy[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Locale | null>(null);
  const current = pending && chosen ? chosen : locale;

  function choose(next: Locale) {
    if (next === locale) return;
    setChosen(next);
    persistLocale(next);
    startTransition(() => router.refresh());
  }

  return (
    <div aria-busy={pending} className="numbered-section">
      <h3 id="settings-language-title">{t.languageTitle}</h3>
      <p>{t.languageLead}</p>
      <fieldset aria-labelledby="settings-language-title" style={{ border: 0, margin: 0, padding: 0 }}>
        <div className="radio-grid">
          {locales.map((item) => (
            <label className={`radio-card${current === item ? " selected" : ""}`} key={item}>
              <input checked={current === item} name="interface-language" onChange={() => choose(item)} type="radio" value={item} />
              <strong lang={item}>{localeNames[item]}</strong>
              <span>{t.languageHints[item]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function SettingsClient({ settings: initialSettings, account, ai, theme, user, initialSection, activity }: { settings: WorkspaceSettings | null; account: AccountSummary | null; ai: AiStatus | null; theme: Theme; user: CurrentUser; initialSection?: string | undefined; activity: ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const t = copy[locale];
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify: Notify = (text, tone = "ok") => setNotice({ text, tone });
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
      if (!response.ok) { notify((await readApiError(response)).message, "error"); return; }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `devcontext-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      notify(t.exportDownloaded);
    } catch {
      notify(t.exportFailed, "error");
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
        notify((await readApiError(response)).message, "error");
        return;
      }
      setSettings(workspaceSettingsResponseSchema.parse(await response.json()).settings);
      notify(state === "new" ? t.guideReset : t.setupMarked);
      router.refresh();
    } catch {
      notify(t.workspaceUnreachable, "error");
    } finally {
      setPending(null);
    }
  }

  async function installSamples() {
    setPending("samples");
    try {
      const response = await fetch("/api/workspace/samples", { method: "POST" });
      if (!response.ok) {
        notify((await readApiError(response)).message, "error");
        return;
      }
      const result = sampleInstallResponseSchema.parse(await response.json());
      setSettings(result.settings);
      notify(result.created ? t.samplesInstalledNotice(result.counts) : t.samplesAlready);
      router.refresh();
    } catch {
      notify(t.workspaceUnreachable, "error");
    } finally {
      setPending(null);
    }
  }

  async function removeSamples() {
    if (!window.confirm(t.removeConfirm)) return;
    setPending("samples");
    try {
      const response = await fetch("/api/workspace/samples", { method: "DELETE" });
      if (!response.ok) {
        notify((await readApiError(response)).message, "error");
        return;
      }
      const result = sampleRemoveResponseSchema.parse(await response.json());
      setSettings(result.settings);
      notify(t.samplesRemovedNotice(result.removed));
      router.refresh();
    } catch {
      notify(t.workspaceUnreachable, "error");
    } finally {
      setPending(null);
    }
  }

  const samplesInstalled = Boolean(settings?.sampleVersion);
  const onboardingText = settings ? t.onboarding[settings.onboardingState] : t.onboardingUnknown;

  return (
    <section className="page">
      <h1 className="page-title">{t.title}</h1>
      {settings === null && <p className="note warning" role="status" style={{ marginTop: 16 }}>{t.settingsFailed}</p>}
      <div className="settings-layout">
        <nav aria-label={t.sectionNav} className="settings-nav">
          {sections.map((section) => <a aria-current={active === section.id ? "true" : undefined} href={`#${section.id}`} key={section.id} onClick={() => setActive(section.id)}><section.icon aria-hidden size={22} />{t.sections[section.key]}</a>)}
        </nav>
        <div className="settings-body">
          <section aria-labelledby="settings-account-title" className="settings-section" id="settings-account">
            <h2 id="settings-account-title">{t.sections.account}</h2>
            <p className="lead">{t.accountLead}</p>
            <div aria-label={t.accountDetails} className="account-card" role="region">
              <span className="avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}><strong>{user.name}</strong><small>{user.email}</small><small style={{ display: "block", marginTop: 4 }}>{onboardingText}</small></div>
            </div>
            <div className="actions">
              <button className="button" disabled={pending !== null} onClick={() => void updateOnboarding("new")} type="button">{t.showGuide}</button>
              {settings?.onboardingState !== "completed" && <button className="button" disabled={pending !== null} onClick={() => void updateOnboarding("completed")} type="button">{t.completeSetup}</button>}
            </div>
            <PasswordForm onNotice={notify} />
          </section>

          <section aria-labelledby="settings-activity-title" className="settings-section" id="settings-activity">
            <h2 id="settings-activity-title">{t.sections.activity}</h2>
            <p className="lead">{t.activityLead}</p>
            {activity}
          </section>

          <section aria-labelledby="settings-appearance-title" className="settings-section" id="settings-appearance">
            <h2 id="settings-appearance-title">{t.sections.appearance}</h2>
            <p className="lead">{t.appearanceLead}</p>
            <ThemeCards initialTheme={theme} />
            <LanguageChoice />
            <p className="note" style={{ marginTop: 18, background: "transparent", padding: 0 }}><Info aria-hidden size={20} />{t.rememberedNote}</p>
          </section>

          <section aria-labelledby="settings-samples-title" className="settings-section" id="settings-samples">
            <h2 id="settings-samples-title">{t.sections.samples}</h2>
            <p className="lead">{t.samplesLead}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                {samplesInstalled
                  ? <><p className="status-label ok"><CheckCircle aria-hidden size={20} />{t.samplesPresent}</p><p className="muted small" style={{ marginTop: 4 }}>{t.installedAt(settings?.sampleInstalledAt ? formatDateTime(settings.sampleInstalledAt, locale) : t.sampleVersion(settings?.sampleVersion))}</p></>
                  : <p className="muted">{t.samplesAbsent}</p>}
              </div>
              <div className="actions" style={{ marginTop: 0 }}>
                <button className={`button${samplesInstalled ? "" : " primary"}`} disabled={pending !== null || samplesInstalled} onClick={() => void installSamples()} type="button"><Database aria-hidden size={20} />{pending === "samples" && !samplesInstalled ? t.installing : samplesInstalled ? t.samplesAdded : t.addSamples}</button>
                {samplesInstalled && <button className="button quiet" disabled={pending !== null} onClick={() => void removeSamples()} type="button">{pending === "samples" ? t.processing : t.removeSamples}</button>}
              </div>
            </div>
          </section>

          <ImportSection exporting={pending === "export"} onExport={(event) => void downloadExport(event)} onNotice={notify} />

          <PrivacySection ai={ai} initial={account} onNotice={notify} user={user} />

          <section aria-labelledby="settings-plan-title" className="settings-section" id="settings-plan">
            <h2 id="settings-plan-title">{t.sections.plan}</h2>
            <p className="lead">{t.planLead}</p>
            <Link className="button" href="/workspace/billing"><CreditCard aria-hidden size={20} />{t.openPlan}</Link>
          </section>

          <section aria-labelledby="settings-help-title" className="settings-section" id="settings-help">
            <h2 id="settings-help-title">{t.sections.help}</h2>
            <p className="lead">{t.helpLead(productName)}</p>
            <dl style={{ display: "grid", gap: 16 }}>
              <div><dt style={{ fontWeight: 600 }}>{t.helpContextTerm}</dt><dd className="muted">{t.helpContextText}</dd></div>
              <div><dt style={{ fontWeight: 600 }}>{t.helpHistoryTerm}</dt><dd className="muted">{t.helpHistoryText}</dd></div>
              <div><dt style={{ fontWeight: 600 }}>{t.helpModesTerm}</dt><dd className="muted">{t.helpModes.map(([term, text], index) => <Fragment key={term}>{index > 0 ? " " : null}<strong>{term}</strong> {text}</Fragment>)}</dd></div>
              <div><dt style={{ fontWeight: 600 }}>{t.helpWarningsTerm}</dt><dd className="muted">{t.helpWarningsText}</dd></div>
            </dl>
          </section>
        </div>
      </div>
      {notice && (
        <div className="toast" role={notice.tone === "error" ? "alert" : "status"}>
          <span className={`status-label ${notice.tone}`}>{notice.tone === "error" ? <WarningCircle aria-hidden size={18} /> : <CheckCircle aria-hidden size={18} />}{notice.text}</span>
        </div>
      )}
    </section>
  );
}
