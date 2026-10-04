"use client";

import {
  compileResponseSchema,
  contextDiffResponseSchema,
  contextVersionResponseSchema,
  exportListResponseSchema,
  exportResponseSchema,
  type ContextDiff,
  type ContextState,
  type ContextVersion,
  type ContextVersionSummary,
  type ExportEvent,
  type ExportTarget,
  type Project,
} from "@devcontext/contracts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Markdown, { type Components } from "react-markdown";
import {
  ArrowRight,
  ArrowsClockwise,
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  Copy,
  DownloadSimple,
  ListBullets,
  MinusCircle,
  PencilSimple,
  PlusCircle,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { DecisionBadge, ModeIcon } from "../../../../../components/decision-badge";
import { useLocale } from "../../../../../components/locale-provider";
import { LogoSpinner } from "../../../../../components/logo-mark";
import { TechLogo } from "../../../../../components/tech-logo";
import { ContextStatusLabel } from "../../../../../components/status-label";
import { catalogSlugFor } from "../../../../../lib/logos";
import { modeLabels, originLabel, slotLabel } from "../../../../../lib/decision-slots";
import { readApiError } from "../../../../../lib/errors";
import { defineCopy, type Locale } from "../../../../../lib/i18n";
import { formatDate, formatDateTime, pluralCount } from "../../../../../lib/resource-labels";
import { warningTitles } from "../../../../../lib/warning-labels";

/** Screen copy. Named `contextCopy` because the component has its own `copy()` action. */
const contextCopy = defineCopy({
  tr: {
    placement: (fileName: string) => ` Deponda ${fileName} yoluna kaydet.`,
    notInVersion: "Bu sürümde yok",
    beforeVersion: (version: number, date: string) => `Önce (v${version} · ${date})`,
    before: "Önce",
    afterVersion: (version: number, date: string) => `Sonra (v${version} · ${date})`,
    after: "Sonra",
    compareTitle: "Sürüm karşılaştırması",
    compareLead: (from: number, to: number) => `v${from} ile v${to} arasındaki karar ve kural değişikliklerini gözden geçir.`,
    pickTwo: "Karşılaştırmak için iki sürüm seç.",
    earlierVersion: "Önceki sürüm",
    laterVersion: "Sonraki sürüm",
    beforeOption: (version: number, date: string) => `Önce: v${version} · ${date}`,
    afterOption: (version: number, date: string) => `Sonra: v${version} · ${date}`,
    viewMode: "Görünüm",
    decisions: "Kararlar",
    rawText: "Ham metin",
    openCurrent: "Güncel talimatları aç",
    comparing: "Sürümler karşılaştırılıyor…",
    singleVersion: "Şimdilik tek sürüm var. Kararları değiştirip yeniden oluşturduğunda farklar burada görünür.",
    noVersion: "Henüz oluşturulmuş bir sürüm yok.",
    changes: "Değişiklikler",
    unchanged: "Değişmedi",
    sameMeaning: (from: number | null, to: number | null) => `v${from ?? ""} ve v${to ?? ""} anlam olarak aynı.`,
    changed: "Değişti",
    compilerVersion: "Derleyici sürümü",
    outputMayDiffer: "Çıktı biçimi kararlar değişmese de farklı olabilir.",
    added: "Eklendi",
    removed: "Kaldırıldı",
    decisionWord: " kararı ",
    projectRule: "Proje kuralı",
    rule: "Kural",
    referenceResource: "Referans kaynak",
    newWarning: "Yeni uyarı",
    resolved: "Çözüldü",
    changeSummary: "Değişiklik özeti",
    decisionsUpdated: (_count: number) => "karar güncellendi",
    decisionsAdded: (_count: number) => "karar eklendi",
    decisionsRemoved: (_count: number) => "karar kaldırıldı",
    rulesAdded: (_count: number) => "kural eklendi",
    rulesRemoved: (_count: number) => "kural kaldırıldı",
    noSemanticDiff: "İki sürüm arasında anlamsal fark yok.",
    sourcesVisible: "Kaynaklar görünür",
    sourcesVisibleText: "Her değişiklik proje kararlarına ve Kütüphane kaynaklarına bağlıdır.",
    versionCreated: (version: number, date: string) => `v${version} oluşturulma: ${date}`,
    loadFailed: "Talimatlar yüklenemedi. Sayfayı yenileyip tekrar dene.",
    diffFailed: "Karşılaştırma yüklenemedi. Tekrar dene.",
    versionCreatedNotice: (version: number) => `Sürüm ${version} oluşturuldu.`,
    noChangesSince: (version: number) => `Sürüm ${version} sonrasında değişiklik yok.`,
    compilerUnreachable: "Derleyiciye ulaşılamıyor. Tekrar dene.",
    versionLoadFailed: "Sürüm yüklenemedi. Tekrar dene.",
    copied: (name: string, version: number) => `${name} kopyalandı (sürüm ${version}).`,
    copyFailed: "Kopyalanamadı. Önizleme metnini seçip elle kopyala.",
    downloaded: (name: string, version: number) => `${name} indirildi (sürüm ${version}).`,
    downloadFailed: "İndirme başarısız. Tekrar dene.",
    bundleFailed: "Paket indirilemedi. Tekrar dene.",
    creating: "Oluşturuluyor…",
    recreate: "Yeniden oluştur",
    create: "Talimatları oluştur",
    needsRefresh: "Yenileme gerekli",
    staleText: (next: number) => `Son oluşturmadan sonra kararlar veya kurallar değişti. Yeniden oluşturarak sürüm ${next} yayınla.`,
    draftWarnings: (count: number) => ` Taslakta ${pluralCount(count, "uyarı")} var.`,
    warningsFor: (version: number, count: number) => `Sürüm ${version} için ${pluralCount(count, "uyarı")}`,
    warningsNote: "Uyarılar kararlarını değiştirmez. Teknoloji yığınında veya Kütüphane’de düzelt ve yeniden oluştur.",
    projectDecisions: "Proje kararları",
    edit: "Düzenle",
    builtFrom: "Talimatların bu tercihlerden oluşturuldu.",
    noDecisions: "Bu sürümde karar yok.",
    projectRules: "Proje kuralları",
    noRules: "Bu sürüme eklenmiş kural yok.",
    sourceFoot: (version: number) => `Kaynak: Proje tercihleri ve Kütüphane · v${version}`,
    aiInstructions: "AI talimatları",
    repoPath: "Depodaki yolu",
    codingAgent: "Kodlama ajanı",
    versionDiffs: "Sürüm farkları",
    copying: "Kopyalanıyor…",
    copy: "Kopyala",
    preparing: "Hazırlanıyor…",
    export: "Dışa aktar",
    viewingVersion: (version: number) => `Sürüm ${version} görüntüleniyor`,
    compiler: (version: string) => `Derleyici ${version}`,
    readingView: "Okuma görünümü",
    packaging: "Paketleniyor…",
    allFiles: "Tüm dosyalar (.zip)",
    viewingNote: (version: number, current: number) => `Sürüm ${version} görüntüleniyor. Güncel sürüm ${current}.`,
    showCurrent: "Güncel sürümü göster",
    preview: "Talimat önizlemesi",
    createdOn: (date: string) => `${date} tarihinde oluşturuldu. İndirilen dosya derleyicinin özgün çıktısını içerir.`,
    history: "Sürüm ve dışa aktarma geçmişi",
    versions: "Sürümler",
    decisionCount: (count: number) => pluralCount(count, "karar"),
    warningCount: (count: number) => pluralCount(count, "uyarı"),
    exportHistory: "Dışa aktarma geçmişi",
    noExports: "Henüz dışa aktarım yok. Bir talimat dosyasını kopyala veya indir.",
    notCreated: "Henüz oluşturulmadı",
    emptyText: "Kütüphane kurallarını ve proje tercihlerini bir araya getirerek Codex, Claude Code, Cursor ve Copilot için hazır talimatlar üret.",
  },
  en: {
    placement: (fileName: string) => ` Save it to ${fileName} in your repository.`,
    notInVersion: "Not in this version",
    beforeVersion: (version: number, date: string) => `Before (v${version} · ${date})`,
    before: "Before",
    afterVersion: (version: number, date: string) => `After (v${version} · ${date})`,
    after: "After",
    compareTitle: "Version comparison",
    compareLead: (from: number, to: number) => `Review the decision and rule changes between v${from} and v${to}.`,
    pickTwo: "Pick two versions to compare.",
    earlierVersion: "Earlier version",
    laterVersion: "Later version",
    beforeOption: (version: number, date: string) => `Before: v${version} · ${date}`,
    afterOption: (version: number, date: string) => `After: v${version} · ${date}`,
    viewMode: "View",
    decisions: "Decisions",
    rawText: "Raw text",
    openCurrent: "Open current instructions",
    comparing: "Comparing versions…",
    singleVersion: "There is only one version so far. When you change decisions and create the instructions again, the differences show up here.",
    noVersion: "No version has been created yet.",
    changes: "Changes",
    unchanged: "Unchanged",
    sameMeaning: (from: number | null, to: number | null) => `v${from ?? ""} and v${to ?? ""} have the same meaning.`,
    changed: "Changed",
    compilerVersion: "Compiler version",
    outputMayDiffer: "The output format can differ even when the decisions do not.",
    added: "Added",
    removed: "Removed",
    decisionWord: " decision ",
    projectRule: "Project rule",
    rule: "Rule",
    referenceResource: "Reference resource",
    newWarning: "New warning",
    resolved: "Resolved",
    changeSummary: "Change summary",
    decisionsUpdated: (count: number) => count === 1 ? "decision updated" : "decisions updated",
    decisionsAdded: (count: number) => count === 1 ? "decision added" : "decisions added",
    decisionsRemoved: (count: number) => count === 1 ? "decision removed" : "decisions removed",
    rulesAdded: (count: number) => count === 1 ? "rule added" : "rules added",
    rulesRemoved: (count: number) => count === 1 ? "rule removed" : "rules removed",
    noSemanticDiff: "There is no semantic difference between the two versions.",
    sourcesVisible: "Sources stay visible",
    sourcesVisibleText: "Every change is tied to project decisions and Library resources.",
    versionCreated: (version: number, date: string) => `v${version} created: ${date}`,
    loadFailed: "The instructions could not be loaded. Refresh the page and try again.",
    diffFailed: "The comparison could not be loaded. Try again.",
    versionCreatedNotice: (version: number) => `Version ${version} created.`,
    noChangesSince: (version: number) => `No changes since version ${version}.`,
    compilerUnreachable: "The compiler cannot be reached. Try again.",
    versionLoadFailed: "The version could not be loaded. Try again.",
    copied: (name: string, version: number) => `${name} copied (version ${version}).`,
    copyFailed: "Could not copy. Select the preview text and copy it by hand.",
    downloaded: (name: string, version: number) => `${name} downloaded (version ${version}).`,
    downloadFailed: "Download failed. Try again.",
    bundleFailed: "The bundle could not be downloaded. Try again.",
    creating: "Creating…",
    recreate: "Recreate",
    create: "Create instructions",
    needsRefresh: "Needs refresh",
    staleText: (next: number) => `Decisions or rules changed since the last build. Recreate the instructions to publish version ${next}.`,
    draftWarnings: (count: number) => ` The draft has ${pluralCount(count, "warning", "warnings")}.`,
    warningsFor: (version: number, count: number) => `${pluralCount(count, "warning", "warnings")} for version ${version}`,
    warningsNote: "Warnings do not change your decisions. Fix them in the tech stack or the Library and create the instructions again.",
    projectDecisions: "Project decisions",
    edit: "Edit",
    builtFrom: "Your instructions were created from these choices.",
    noDecisions: "No decisions in this version.",
    projectRules: "Project rules",
    noRules: "No rules were added to this version.",
    sourceFoot: (version: number) => `Source: project choices and Library · v${version}`,
    aiInstructions: "AI instructions",
    repoPath: "Path in the repository",
    codingAgent: "Coding agent",
    versionDiffs: "Version differences",
    copying: "Copying…",
    copy: "Copy",
    preparing: "Preparing…",
    export: "Export",
    viewingVersion: (version: number) => `Viewing version ${version}`,
    compiler: (version: string) => `Compiler ${version}`,
    readingView: "Reading view",
    packaging: "Packaging…",
    allFiles: "All files (.zip)",
    viewingNote: (version: number, current: number) => `Viewing version ${version}. The current version is ${current}.`,
    showCurrent: "Show current version",
    preview: "Instruction preview",
    createdOn: (date: string) => `Created on ${date}. The downloaded file contains the compiler's original output.`,
    history: "Version and export history",
    versions: "Versions",
    decisionCount: (count: number) => pluralCount(count, "decision", "decisions"),
    warningCount: (count: number) => pluralCount(count, "warning", "warnings"),
    exportHistory: "Export history",
    noExports: "No exports yet. Copy or download an instruction file.",
    notCreated: "Not created yet",
    emptyText: "Combine your Library rules and project choices into ready-made instructions for Codex, Claude Code, Cursor and Copilot.",
  },
});

type Tab = ExportTarget | "canonical";
type View = "document" | "diff";
type DiffResult = { from: ContextVersionSummary | null; to: ContextVersionSummary | null; diff: ContextDiff | null };
type DiffState = DiffResult | null | "loading" | { error: string };

/**
 * Links inside a preview come from Library entries and rules (possibly from an
 * imported file): only absolute http(s) links become anchors, and they open in
 * a new tab without access to this window. Anything else stays plain text.
 */
const markdownComponents: Components = {
  a({ href, children }) {
    const url = typeof href === "string" ? URL.parse(href) : null;
    if (!url || !["http:", "https:"].includes(url.protocol)) return <span>{children}</span>;
    return <a href={url.toString()} rel="noopener noreferrer nofollow" target="_blank">{children}</a>;
  },
};

const agentOptions = defineCopy<Array<{ id: Tab; label: string }>>({
  tr: [
    { id: "agents", label: "Codex" },
    { id: "claude", label: "Claude Code" },
    { id: "cursor", label: "Cursor" },
    { id: "copilot", label: "Copilot" },
    { id: "generic", label: "Genel talimat" },
    { id: "canonical", label: "JSON" },
  ],
  en: [
    { id: "agents", label: "Codex" },
    { id: "claude", label: "Claude Code" },
    { id: "cursor", label: "Cursor" },
    { id: "copilot", label: "Copilot" },
    { id: "generic", label: "General instructions" },
    { id: "canonical", label: "JSON" },
  ],
});

const projectFieldLabels = defineCopy<Record<string, string>>({
  tr: { name: "Proje adı", description: "Açıklama", productType: "Ürün türü", stage: "Aşama", platforms: "Platformlar", priorities: "Öncelikler", recipe: "Tarif", profiles: "Profiller" },
  en: { name: "Project name", description: "Description", productType: "Product type", stage: "Stage", platforms: "Platforms", priorities: "Priorities", recipe: "Recipe", profiles: "Profiles" },
});

type CanonicalDecision = ContextVersion["canonical"]["decisions"][number];
type DiffDecision = NonNullable<ContextDiff["decisions"][number]["after"]>;

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortKeys(record[key])]));
  }
  return value;
}

function canonicalJson(version: ContextVersion) {
  return JSON.stringify(sortKeys(version.canonical), null, 2);
}

function summaryOf(version: ContextVersion): ContextVersionSummary {
  const { id, version: number, compilerVersion, contentHash, decisionCount, warningCount, createdAt } = version;
  return { id, version: number, compilerVersion, contentHash, decisionCount, warningCount, createdAt };
}

function downloadName(fileName: string) {
  return fileName.split("/").pop() ?? fileName;
}

/** The browser drops folders from a download name, so a nested target says where it belongs in the repository. */
function placementHint(fileName: string, locale: Locale) {
  return fileName.includes("/") ? contextCopy[locale].placement(fileName) : "";
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function DecisionSide({ decision, label }: { decision: DiffDecision | CanonicalDecision | null; label: string }) {
  const locale = useLocale();
  return (
    <div className="diff-side">
      <small className="label">{label}</small>
      {decision ? (
        <>
          <div className="identity">
            {decision.resource
              ? <span className="mark"><TechLogo name={decision.resource.name} size={26} slug={catalogSlugFor(decision.resource)} /></span>
              : <span className="mark"><ModeIcon mode={decision.mode} size={22} /></span>}
            <strong>{decision.resource?.name ?? modeLabels[locale][decision.mode]}</strong>
          </div>
          <DecisionBadge mode={decision.mode} />
          <span className="origin">{originLabel(decision, locale)}</span>
        </>
      ) : (
        <>
          <strong style={{ display: "block", color: "var(--muted-2)" }}>—</strong>
          <span className="origin">{contextCopy[locale].notInVersion}</span>
        </>
      )}
    </div>
  );
}

function TextSide({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  const locale = useLocale();
  return (
    <div className="diff-side">
      <small className="label">{label}</small>
      {value ? <strong style={{ display: "block", fontSize: 17 }}>{value}</strong> : <strong style={{ display: "block", color: "var(--muted-2)" }}>—</strong>}
      <span className="origin">{value ? sub ?? "" : contextCopy[locale].notInVersion}</span>
    </div>
  );
}

function DiffView({ result, versions, from, to, onRange, raw, onRaw, rawText, onOpenCurrent }: {
  result: DiffState;
  versions: ContextVersionSummary[];
  from: number | null;
  to: number | null;
  onRange(from: number, to: number): void;
  raw: boolean;
  onRaw(value: boolean): void;
  rawText: string;
  onOpenCurrent(): void;
}) {
  const locale = useLocale();
  const t = contextCopy[locale];
  const options = [...versions].sort((a, b) => b.version - a.version);
  const fromSummary = options.find((item) => item.version === from) ?? null;
  const toSummary = options.find((item) => item.version === to) ?? null;
  const beforeLabel = fromSummary ? t.beforeVersion(fromSummary.version, formatDate(fromSummary.createdAt, locale)) : t.before;
  const afterLabel = toSummary ? t.afterVersion(toSummary.version, formatDate(toSummary.createdAt, locale)) : t.after;
  const diff = result && result !== "loading" && !("error" in result) ? result.diff : null;
  const decisionRows = diff?.decisions ?? [];
  const counts = {
    changed: decisionRows.filter((item) => item.kind === "changed").length,
    added: decisionRows.filter((item) => item.kind === "added").length,
    removed: decisionRows.filter((item) => item.kind === "removed").length,
    rulesAdded: diff?.rules.added.length ?? 0,
    rulesRemoved: diff?.rules.removed.length ?? 0,
  };
  const empty = diff !== null && diff.unchanged;

  return (
    <section aria-labelledby="diff-title">
      <div className="page-head" style={{ marginTop: 28 }}>
        <div>
          <h2 className="page-title" id="diff-title">{t.compareTitle}</h2>
          <p className="page-lead">{from !== null && to !== null ? t.compareLead(from, to) : t.pickTwo}</p>
        </div>
      </div>
      <div className="diff-controls">
        <label className="field" style={{ display: "contents" }}>
          <span className="visually-hidden">{t.earlierVersion}</span>
          <select aria-label={t.earlierVersion} className="select inline" onChange={(event) => onRange(Number(event.target.value), to ?? Number(event.target.value))} value={from ?? ""}>
            {options.map((item) => <option key={item.id} value={item.version}>{t.beforeOption(item.version, formatDate(item.createdAt, locale))}</option>)}
          </select>
        </label>
        <label className="field" style={{ display: "contents" }}>
          <span className="visually-hidden">{t.laterVersion}</span>
          <select aria-label={t.laterVersion} className="select inline" onChange={(event) => onRange(from ?? Number(event.target.value), Number(event.target.value))} value={to ?? ""}>
            {options.map((item) => <option key={item.id} value={item.version}>{t.afterOption(item.version, formatDate(item.createdAt, locale))}</option>)}
          </select>
        </label>
        <div aria-label={t.viewMode} className="pill-group" role="group">
          <button aria-pressed={!raw} onClick={() => onRaw(false)} type="button">{t.decisions}</button>
          <button aria-pressed={raw} onClick={() => onRaw(true)} type="button">{t.rawText}</button>
        </div>
        <span className="spacer" />
        <button className="button primary" onClick={onOpenCurrent} type="button">{t.openCurrent} <ArrowSquareOut aria-hidden size={18} /></button>
      </div>
      {result === "loading" && <p className="note" style={{ marginTop: 24 }}>{t.comparing}</p>}
      {result !== null && typeof result === "object" && "error" in result && <p className="note danger" role="alert" style={{ marginTop: 24 }}>{result.error}</p>}
      {result && result !== "loading" && !("error" in result) && !result.diff && (
        <p className="note" style={{ marginTop: 24 }}>{result.to ? t.singleVersion : t.noVersion}</p>
      )}
      {raw && diff && (
        <pre className="raw-preview" style={{ marginTop: 24 }} tabIndex={0}>{rawText}</pre>
      )}
      {!raw && diff && (
        <div className="diff-layout">
          <ul className="diff-rows" aria-label={t.changes}>
            {empty && <li className="unchanged"><div><span className="diff-kind"><MinusCircle aria-hidden size={20} />{t.unchanged}</span><small>{t.sameMeaning(from, to)}</small></div></li>}
            {diff.compilerVersion && (
              <li className="changed">
                <div><span className="diff-kind"><ArrowsClockwise aria-hidden size={20} />{t.changed}</span><small>{t.compilerVersion}</small></div>
                <TextSide label={beforeLabel} value={diff.compilerVersion.before} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} sub={t.outputMayDiffer} value={diff.compilerVersion.after} />
              </li>
            )}
            {diff.project.map((change) => (
              <li className="changed" key={change.field}>
                <div><span className="diff-kind"><ArrowsClockwise aria-hidden size={20} />{t.changed}</span><small>{projectFieldLabels[locale][change.field] ?? change.field}</small></div>
                <TextSide label={beforeLabel} value={change.before ?? null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} value={change.after ?? null} />
              </li>
            ))}
            {decisionRows.map((change) => (
              <li className={change.kind} key={change.slot}>
                <div>
                  <span className="diff-kind">
                    {change.kind === "changed" ? <ArrowsClockwise aria-hidden size={20} /> : change.kind === "added" ? <PlusCircle aria-hidden size={20} /> : <MinusCircle aria-hidden size={20} />}
                    {change.kind === "changed" ? t.changed : change.kind === "added" ? t.added : t.removed}
                  </span>
                  <small>{slotLabel(change.slot, locale)}{t.decisionWord}<code className="code">{change.slot}</code></small>
                </div>
                <DecisionSide decision={change.before} label={beforeLabel} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <DecisionSide decision={change.after} label={afterLabel} />
              </li>
            ))}
            {diff.rules.added.map((rule) => (
              <li className="added" key={`rule-added-${rule}`}>
                <div><span className="diff-kind"><PlusCircle aria-hidden size={20} />{t.added}</span><small>{t.projectRule}</small></div>
                <TextSide label={beforeLabel} value={null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} sub={t.rule} value={rule} />
              </li>
            ))}
            {diff.rules.removed.map((rule) => (
              <li className="removed" key={`rule-removed-${rule}`}>
                <div><span className="diff-kind"><MinusCircle aria-hidden size={20} />{t.removed}</span><small>{t.projectRule}</small></div>
                <TextSide label={beforeLabel} sub={t.rule} value={rule} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} value={null} />
              </li>
            ))}
            {diff.resources.added.map((resource) => (
              <li className="added" key={`res-added-${resource.id}`}>
                <div><span className="diff-kind"><PlusCircle aria-hidden size={20} />{t.added}</span><small>{t.referenceResource}</small></div>
                <TextSide label={beforeLabel} value={null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} sub={resource.type} value={resource.name} />
              </li>
            ))}
            {diff.resources.removed.map((resource) => (
              <li className="removed" key={`res-removed-${resource.id}`}>
                <div><span className="diff-kind"><MinusCircle aria-hidden size={20} />{t.removed}</span><small>{t.referenceResource}</small></div>
                <TextSide label={beforeLabel} sub={resource.type} value={resource.name} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} value={null} />
              </li>
            ))}
            {diff.warnings.added.map((warning, index) => (
              <li className="changed" key={`warn-added-${index}`}>
                <div><span className="diff-kind"><PlusCircle aria-hidden size={20} />{t.newWarning}</span><small><code className="code">{warning.code}</code></small></div>
                <TextSide label={beforeLabel} value={null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} value={warning.message} />
              </li>
            ))}
            {diff.warnings.removed.map((warning, index) => (
              <li className="added" key={`warn-removed-${index}`}>
                <div><span className="diff-kind"><CheckCircle aria-hidden size={20} />{t.resolved}</span><small><code className="code">{warning.code}</code></small></div>
                <TextSide label={beforeLabel} value={warning.message} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight aria-hidden size={22} /></span>
                <TextSide label={afterLabel} value={null} />
              </li>
            ))}
          </ul>
          <aside className="diff-summary" aria-label={t.changeSummary}>
            <h3>{t.changeSummary}</h3>
            {counts.changed > 0 && <div className="diff-stat"><span className="mark locked"><ArrowsClockwise aria-hidden size={22} /></span><div><strong>{counts.changed}</strong><span>{t.decisionsUpdated(counts.changed)}</span></div></div>}
            {counts.added > 0 && <div className="diff-stat"><span className="mark success"><PlusCircle aria-hidden size={22} /></span><div><strong>{counts.added}</strong><span>{t.decisionsAdded(counts.added)}</span></div></div>}
            {counts.removed > 0 && <div className="diff-stat"><span className="mark locked"><MinusCircle aria-hidden size={22} /></span><div><strong>{counts.removed}</strong><span>{t.decisionsRemoved(counts.removed)}</span></div></div>}
            {counts.rulesAdded > 0 && <div className="diff-stat"><span className="mark success"><PlusCircle aria-hidden size={22} /></span><div><strong>{counts.rulesAdded}</strong><span>{t.rulesAdded(counts.rulesAdded)}</span></div></div>}
            {counts.rulesRemoved > 0 && <div className="diff-stat"><span className="mark locked"><MinusCircle aria-hidden size={22} /></span><div><strong>{counts.rulesRemoved}</strong><span>{t.rulesRemoved(counts.rulesRemoved)}</span></div></div>}
            {empty && <p className="muted">{t.noSemanticDiff}</p>}
            <hr className="divider" style={{ margin: "4px 0" }} />
            <div>
              <h3 style={{ fontSize: 17 }}>{t.sourcesVisible}</h3>
              <p className="status-label ok" style={{ whiteSpace: "normal", marginTop: 8, fontWeight: 400 }}><CheckCircle aria-hidden size={20} />{t.sourcesVisibleText}</p>
            </div>
            <ul className="meta">
              {fromSummary && <li>{t.versionCreated(fromSummary.version, formatDateTime(fromSummary.createdAt, locale))}</li>}
              {toSummary && <li>{t.versionCreated(toSummary.version, formatDateTime(toSummary.createdAt, locale))}</li>}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}

export function ContextClient({ project, initial, versions: initialVersions, exports: initialExports, initialView = "document" }: {
  project: Project;
  initial: ContextState | null;
  versions: ContextVersionSummary[];
  exports: ExportEvent[];
  initialView?: View;
}) {
  const locale = useLocale();
  const t = contextCopy[locale];
  const router = useRouter();
  const [state, setState] = useState<ContextState | null>(initial);
  const [versions, setVersions] = useState(initialVersions);
  const [exports, setExports] = useState(initialExports);
  const [viewing, setViewing] = useState<ContextVersion | null>(initial?.version ?? null);
  const [raw, setRaw] = useState(false);
  const [tab, setTab] = useState<Tab>("agents");
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState<"compile" | "copy" | "download" | "bundle" | "view" | null>(null);
  const [notice, setNotice] = useState<string | null>(initial === null ? t.loadFailed : null);
  const [diffRange, setDiffRange] = useState<{ from: number | null; to: number | null }>({ from: null, to: null });
  const [diffResult, setDiffResult] = useState<DiffState>(null);
  const [diffRaw, setDiffRaw] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const current = state?.version ?? null;
  const diffTo = diffRange.to ?? viewing?.version ?? null;
  const diffFrom = diffRange.from ?? (diffTo !== null && diffTo > 1 ? diffTo - 1 : null);

  useEffect(() => {
    if (view !== "diff" || diffTo === null) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ to: String(diffTo) });
    if (diffFrom !== null) params.set("from", String(diffFrom));
    void (async () => {
      setDiffResult("loading");
      try {
        const response = await fetch(`/api/projects/${project.id}/context/diff?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          // Plan refusals and other API errors carry a plain message; show it instead of a generic failure.
          setDiffResult({ error: (await readApiError(response)).message });
          return;
        }
        setDiffResult(contextDiffResponseSchema.parse(await response.json()));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setDiffResult({ error: t.diffFailed });
      }
    })();
    return () => controller.abort();
  }, [view, diffFrom, diffTo, project.id, versions.length, t]);

  const preview = viewing && tab !== "canonical" ? viewing.previews.find((item) => item.target === tab) ?? null : null;
  const content = viewing ? (tab === "canonical" ? canonicalJson(viewing) : preview?.content ?? "") : "";
  const fileName = viewing ? (tab === "canonical" ? `project-context-v${viewing.version}.json` : preview?.fileName ?? "") : "";
  const statusKind = current ? (state?.stale ? "stale" : "fresh") : "none";

  async function compile() {
    setBusy("compile");
    try {
      const response = await fetch(`/api/projects/${project.id}/compile`, { method: "POST" });
      if (!response.ok) {
        setNotice((await readApiError(response)).message);
        return;
      }
      const result = compileResponseSchema.parse(await response.json());
      setState({ version: result.version, stale: false, draftHash: result.version.contentHash, draftWarnings: result.version.canonical.warnings });
      setViewing(result.version);
      if (result.created) setVersions((previous) => [summaryOf(result.version), ...previous.filter((item) => item.version !== result.version.version)]);
      setNotice(result.created ? t.versionCreatedNotice(result.version.version) : t.noChangesSince(result.version.version));
      router.refresh();
    } catch {
      setNotice(t.compilerUnreachable);
    } finally {
      setBusy(null);
    }
  }

  async function viewVersion(versionNumber: number) {
    if (current && versionNumber === current.version) {
      setViewing(current);
      return;
    }
    setBusy("view");
    try {
      const response = await fetch(`/api/projects/${project.id}/context/versions/${versionNumber}`, { cache: "no-store" });
      if (!response.ok) {
        setNotice((await readApiError(response)).message);
        return;
      }
      setViewing(contextVersionResponseSchema.parse(await response.json()).version);
    } catch {
      setNotice(t.versionLoadFailed);
    } finally {
      setBusy(null);
    }
  }

  async function recordExport(target: ExportTarget, version: number) {
    const response = await fetch(`/api/projects/${project.id}/exports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target, version }),
    });
    if (!response.ok) throw new Error((await readApiError(response)).message);
    const result = exportResponseSchema.parse(await response.json());
    if (result.created) setExports((previous) => [result.event, ...previous]);
    return result.export;
  }

  async function copy() {
    if (!viewing) return;
    setBusy("copy");
    try {
      const text = tab === "canonical" ? content : (await recordExport(tab, viewing.version)).content;
      await navigator.clipboard.writeText(text);
      setNotice(t.copied(downloadName(fileName), viewing.version));
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : t.copyFailed);
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    if (!viewing) return;
    setBusy("download");
    try {
      const text = tab === "canonical" ? content : (await recordExport(tab, viewing.version)).content;
      saveBlob(new Blob([text], { type: tab === "canonical" ? "application/json" : "text/markdown" }), downloadName(fileName));
      setNotice(`${t.downloaded(downloadName(fileName), viewing.version)}${placementHint(fileName, locale)}`);
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : t.downloadFailed);
    } finally {
      setBusy(null);
    }
  }

  async function downloadBundle() {
    if (!viewing) return;
    setBusy("bundle");
    try {
      const response = await fetch(`/api/projects/${project.id}/context/bundle?version=${viewing.version}`, { cache: "no-store" });
      if (!response.ok) {
        setNotice((await readApiError(response)).message);
        return;
      }
      const match = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "");
      const name = match?.[1] ?? `context-v${viewing.version}.zip`;
      saveBlob(await response.blob(), name);
      setNotice(t.downloaded(name, viewing.version));
      const history = await fetch(`/api/projects/${project.id}/exports`, { cache: "no-store" });
      if (history.ok) setExports(exportListResponseSchema.parse(await history.json()).exports);
    } catch {
      setNotice(t.bundleFailed);
    } finally {
      setBusy(null);
    }
  }

  const compileButton = (
    <button aria-busy={busy === "compile"} className={`button${current ? "" : " primary"}`} disabled={busy !== null} onClick={() => void compile()} type="button">
      {busy === "compile" ? <LogoSpinner /> : <ArrowsClockwise aria-hidden size={18} />}
      {busy === "compile" ? t.creating : current ? t.recreate : t.create}
    </button>
  );

  return (
    <section className="context-screen">
      {current && state?.stale && (
        <div className="readiness warn" role="status" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="icon"><ArrowsClockwise aria-hidden size={26} /></span>
            <div>
              <span className="status-label warn">{t.needsRefresh}</span>
              <small>{t.staleText(current.version + 1)}{state.draftWarnings.length > 0 ? t.draftWarnings(state.draftWarnings.length) : ""}</small>
            </div>
          </div>
          <button aria-busy={busy === "compile"} className="button primary" disabled={busy !== null} onClick={() => void compile()} type="button">{busy === "compile" && <LogoSpinner />}{busy === "compile" ? t.creating : t.recreate}</button>
        </div>
      )}

      {viewing && viewing.canonical.warnings.length > 0 && view === "document" && (
        <section aria-labelledby="context-warnings" className="warning-panel" style={{ marginTop: 20 }}>
          <h3 id="context-warnings">{t.warningsFor(viewing.version, viewing.canonical.warnings.length)}</h3>
          <ul>
            {viewing.canonical.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}><code>{warning.code}</code><span><strong>{warningTitles[locale][warning.code]}:</strong> {warning.message}</span></li>
            ))}
          </ul>
          <p>{t.warningsNote}</p>
        </section>
      )}

      {view === "diff" && viewing ? (
        <DiffView
          from={diffFrom}
          onOpenCurrent={() => setView("document")}
          onRange={(from, to) => setDiffRange({ from, to })}
          onRaw={setDiffRaw}
          raw={diffRaw}
          rawText={viewing.previews.find((item) => item.target === "agents")?.content ?? content}
          result={diffResult}
          to={diffTo}
          versions={versions}
        />
      ) : viewing ? (
        <div className="context-grid" style={{ marginTop: 20 }}>
          <aside aria-label={t.projectDecisions} className="source-rail">
            <div className="section-head">
              <h3>{t.projectDecisions}</h3>
              <Link className="text-link" href={`/workspace/projects/${project.id}/stack`} style={{ color: "var(--muted)" }}><PencilSimple aria-hidden size={18} /> {t.edit}</Link>
            </div>
            <p className="lead">{t.builtFrom}</p>
            <ul className="source-list">
              {viewing.canonical.decisions.map((decision) => (
                <li key={decision.slot}>
                  <span className="mark">{decision.resource ? <TechLogo name={decision.resource.name} size={26} slug={catalogSlugFor(decision.resource)} /> : <Sparkle aria-hidden size={22} />}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong>{decision.resource?.name ?? slotLabel(decision.slot, locale)}</strong>
                    <small>{decision.resource ? slotLabel(decision.slot, locale) : originLabel(decision, locale)}</small>
                  </div>
                  <DecisionBadge mode={decision.mode} />
                </li>
              ))}
              {viewing.canonical.decisions.length === 0 && <li><span className="muted">{t.noDecisions}</span></li>}
            </ul>
            <h3 style={{ marginTop: 26 }}>{t.projectRules}</h3>
            {viewing.canonical.rules.length > 0 ? (
              <ul className="source-rules">{viewing.canonical.rules.map((rule, index) => <li key={index}><ListBullets aria-hidden size={18} />{rule}</li>)}</ul>
            ) : <p className="muted small" style={{ marginTop: 10 }}>{t.noRules}</p>}
            <p className="source-foot">{t.sourceFoot(viewing.version)}</p>
          </aside>

          <div className="doc-pane">
            <div className="doc-toolbar">
              <h3>{t.aiInstructions}</h3>
              <span className="chip mono" title={t.repoPath}>{fileName}</span>
              <span className="spacer" />
              <select aria-label={t.codingAgent} className="select inline" onChange={(event) => { const value = event.target.value; if (value === "diff") { setView("diff"); return; } setTab(value as Tab); }} value={tab}>
                {agentOptions[locale].map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                <option value="diff">{t.versionDiffs}</option>
              </select>
              <button className="button" disabled={busy !== null} onClick={() => void copy()} type="button"><Copy aria-hidden size={18} />{busy === "copy" ? t.copying : t.copy}</button>
              <button className="button primary" disabled={busy !== null} onClick={() => void download()} type="button">{busy === "download" ? t.preparing : t.export}<DownloadSimple aria-hidden size={18} /></button>
            </div>
            <div className="doc-subbar">
              {viewing.version === current?.version
                ? <ContextStatusLabel kind={statusKind} size={18} />
                : <ContextStatusLabel kind="none" label={t.viewingVersion(viewing.version)} size={18} />}
              <span>·</span>
              <span>{t.compiler(viewing.compilerVersion)}</span>
              <span>·</span>
              <span className="context-meta"><code>{viewing.contentHash.slice(0, 12)}</code></span>
              <span className="spacer" />
              {tab !== "canonical" && <button aria-pressed={raw} className="button small" onClick={() => setRaw(!raw)} type="button">{raw ? t.readingView : t.rawText}</button>}
              <button className="button small" disabled={busy !== null} onClick={() => void downloadBundle()} type="button">{busy === "bundle" ? t.packaging : t.allFiles}</button>
              {current && !state?.stale && <span className="button small" style={{ display: "contents" }}>{compileButton}</span>}
            </div>
            {current && viewing.version !== current.version && (
              <p className="note" role="status">
                {t.viewingNote(viewing.version, current.version)}{" "}
                <button className="text-link" onClick={() => setViewing(current)} style={{ background: "none", border: 0, padding: 0 }} type="button">{t.showCurrent}</button>
              </p>
            )}
            <div aria-label={t.preview} role="region">
              {raw || tab === "canonical"
                ? <pre className="raw-preview" tabIndex={0}>{content}</pre>
                : <article className="document"><Markdown components={markdownComponents} disallowedElements={["img"]} skipHtml>{content}</Markdown></article>}
            </div>
            <p className="doc-foot">{t.createdOn(formatDateTime(viewing.createdAt, locale))}</p>
            <aside className="context-side">
              <details>
                <summary><CaretDown aria-hidden size={16} />{t.history}</summary>
                <section aria-labelledby="version-history">
                  <h3 id="version-history">{t.versions}</h3>
                  <ol className="version-list">
                    {versions.map((item) => (
                      <li key={item.id}>
                        <button aria-current={viewing.version === item.version ? "true" : undefined} className={viewing.version === item.version ? "active" : ""} disabled={busy !== null} onClick={() => void viewVersion(item.version)} type="button">
                          <strong>v{item.version}</strong>
                          <span>{formatDateTime(item.createdAt, locale)}</span>
                          <small>{t.decisionCount(item.decisionCount)} · {t.warningCount(item.warningCount)}</small>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
                <section aria-labelledby="export-history">
                  <h3 id="export-history">{t.exportHistory}</h3>
                  {exports.length === 0 ? (
                    <p className="muted small">{t.noExports}</p>
                  ) : (
                    <ul className="export-list">
                      {exports.map((item) => (
                        <li key={item.id}><strong>{item.fileName}</strong><span>v{item.contextVersion ?? "?"} · {formatDateTime(item.createdAt, locale)}</span></li>
                      ))}
                    </ul>
                  )}
                </section>
              </details>
            </aside>
          </div>
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 20 }}>
          <span className="mark xl"><Sparkle aria-hidden size={36} /></span>
          <h2>{t.notCreated}</h2>
          <p>{t.emptyText}</p>
          {compileButton}
        </div>
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </section>
  );
}
