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
import Markdown from "react-markdown";
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
import { TechLogo } from "../../../../../components/tech-logo";
import { ContextStatusLabel } from "../../../../../components/status-label";
import { catalogSlugFor } from "../../../../../lib/logos";
import { modeLabels, originLabel, slotLabel } from "../../../../../lib/decision-slots";
import { readApiError } from "../../../../../lib/errors";
import { formatDate, formatDateTime, pluralCount } from "../../../../../lib/resource-labels";

type Tab = ExportTarget | "canonical";
type View = "document" | "diff";
type DiffResult = { from: ContextVersionSummary | null; to: ContextVersionSummary | null; diff: ContextDiff | null };
type DiffState = DiffResult | null | "loading" | { error: string };

const agentOptions: Array<{ id: Tab; label: string }> = [
  { id: "agents", label: "Codex" },
  { id: "claude", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
  { id: "copilot", label: "Copilot" },
  { id: "generic", label: "Genel talimat" },
  { id: "canonical", label: "JSON" },
];

const projectFieldLabels: Record<string, string> = {
  name: "Proje adı", description: "Açıklama", productType: "Ürün türü", stage: "Aşama", platforms: "Platformlar", priorities: "Öncelikler", recipe: "Tarif", profiles: "Profiller",
};

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
  return (
    <div className="diff-side">
      <small className="label">{label}</small>
      {decision ? (
        <>
          <div className="identity">
            {decision.resource
              ? <span className="mark"><TechLogo name={decision.resource.name} size={26} slug={catalogSlugFor(decision.resource)} /></span>
              : <span className="mark"><ModeIcon mode={decision.mode} size={22} /></span>}
            <strong>{decision.resource?.name ?? modeLabels[decision.mode]}</strong>
          </div>
          <DecisionBadge mode={decision.mode} />
          <span className="origin">{originLabel(decision)}</span>
        </>
      ) : (
        <>
          <strong style={{ display: "block", color: "var(--muted-2)" }}>—</strong>
          <span className="origin">Bu sürümde yok</span>
        </>
      )}
    </div>
  );
}

function TextSide({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <div className="diff-side">
      <small className="label">{label}</small>
      {value ? <strong style={{ display: "block", fontSize: 17 }}>{value}</strong> : <strong style={{ display: "block", color: "var(--muted-2)" }}>—</strong>}
      <span className="origin">{value ? sub ?? "" : "Bu sürümde yok"}</span>
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
  const options = [...versions].sort((a, b) => b.version - a.version);
  const fromSummary = options.find((item) => item.version === from) ?? null;
  const toSummary = options.find((item) => item.version === to) ?? null;
  const beforeLabel = fromSummary ? `Önce (v${fromSummary.version} · ${formatDate(fromSummary.createdAt)})` : "Önce";
  const afterLabel = toSummary ? `Sonra (v${toSummary.version} · ${formatDate(toSummary.createdAt)})` : "Sonra";
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
          <h2 className="page-title" id="diff-title">Sürüm karşılaştırması</h2>
          <p className="page-lead">{from !== null && to !== null ? `v${from} ile v${to} arasındaki karar ve kural değişikliklerini gözden geçir.` : "Karşılaştırmak için iki sürüm seç."}</p>
        </div>
      </div>
      <div className="diff-controls">
        <label className="field" style={{ display: "contents" }}>
          <span className="visually-hidden">Önceki sürüm</span>
          <select aria-label="Önceki sürüm" className="select inline" onChange={(event) => onRange(Number(event.target.value), to ?? Number(event.target.value))} value={from ?? ""}>
            {options.map((item) => <option key={item.id} value={item.version}>Önce: v{item.version} · {formatDate(item.createdAt)}</option>)}
          </select>
        </label>
        <label className="field" style={{ display: "contents" }}>
          <span className="visually-hidden">Sonraki sürüm</span>
          <select aria-label="Sonraki sürüm" className="select inline" onChange={(event) => onRange(from ?? Number(event.target.value), Number(event.target.value))} value={to ?? ""}>
            {options.map((item) => <option key={item.id} value={item.version}>Sonra: v{item.version} · {formatDate(item.createdAt)}</option>)}
          </select>
        </label>
        <div aria-label="Görünüm" className="pill-group" role="group">
          <button aria-pressed={!raw} onClick={() => onRaw(false)} type="button">Kararlar</button>
          <button aria-pressed={raw} onClick={() => onRaw(true)} type="button">Ham metin</button>
        </div>
        <span className="spacer" />
        <button className="button primary" onClick={onOpenCurrent} type="button">Güncel talimatları aç <ArrowSquareOut aria-hidden size={18} /></button>
      </div>
      {result === "loading" && <p className="note" style={{ marginTop: 24 }}>Sürümler karşılaştırılıyor…</p>}
      {result !== null && typeof result === "object" && "error" in result && <p className="note danger" role="alert" style={{ marginTop: 24 }}>{result.error}</p>}
      {result && result !== "loading" && !("error" in result) && !result.diff && (
        <p className="note" style={{ marginTop: 24 }}>{result.to ? "Şimdilik tek sürüm var. Kararları değiştirip yeniden oluşturduğunda farklar burada görünür." : "Henüz oluşturulmuş bir sürüm yok."}</p>
      )}
      {raw && diff && (
        <pre className="raw-preview" style={{ marginTop: 24 }} tabIndex={0}>{rawText}</pre>
      )}
      {!raw && diff && (
        <div className="diff-layout">
          <ul className="diff-rows" aria-label="Değişiklikler">
            {empty && <li className="unchanged"><div><span className="diff-kind"><MinusCircle aria-hidden size={20} />Değişmedi</span><small>v{from} ve v{to} anlam olarak aynı.</small></div></li>}
            {diff.compilerVersion && (
              <li className="changed">
                <div><span className="diff-kind"><ArrowsClockwise aria-hidden size={20} />Değişti</span><small>Derleyici sürümü</small></div>
                <TextSide label={beforeLabel} value={diff.compilerVersion.before} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} sub="Çıktı biçimi kararlar değişmese de farklı olabilir." value={diff.compilerVersion.after} />
              </li>
            )}
            {diff.project.map((change) => (
              <li className="changed" key={change.field}>
                <div><span className="diff-kind"><ArrowsClockwise aria-hidden size={20} />Değişti</span><small>{projectFieldLabels[change.field] ?? change.field}</small></div>
                <TextSide label={beforeLabel} value={change.before ?? null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} value={change.after ?? null} />
              </li>
            ))}
            {decisionRows.map((change) => (
              <li className={change.kind} key={change.slot}>
                <div>
                  <span className="diff-kind">
                    {change.kind === "changed" ? <ArrowsClockwise aria-hidden size={20} /> : change.kind === "added" ? <PlusCircle aria-hidden size={20} /> : <MinusCircle aria-hidden size={20} />}
                    {change.kind === "changed" ? "Değişti" : change.kind === "added" ? "Eklendi" : "Kaldırıldı"}
                  </span>
                  <small>{slotLabel(change.slot)} kararı <code className="code">{change.slot}</code></small>
                </div>
                <DecisionSide decision={change.before} label={beforeLabel} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <DecisionSide decision={change.after} label={afterLabel} />
              </li>
            ))}
            {diff.rules.added.map((rule) => (
              <li className="added" key={`rule-added-${rule}`}>
                <div><span className="diff-kind"><PlusCircle aria-hidden size={20} />Eklendi</span><small>Proje kuralı</small></div>
                <TextSide label={beforeLabel} value={null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} sub="Kural" value={rule} />
              </li>
            ))}
            {diff.rules.removed.map((rule) => (
              <li className="removed" key={`rule-removed-${rule}`}>
                <div><span className="diff-kind"><MinusCircle aria-hidden size={20} />Kaldırıldı</span><small>Proje kuralı</small></div>
                <TextSide label={beforeLabel} sub="Kural" value={rule} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} value={null} />
              </li>
            ))}
            {diff.resources.added.map((resource) => (
              <li className="added" key={`res-added-${resource.id}`}>
                <div><span className="diff-kind"><PlusCircle aria-hidden size={20} />Eklendi</span><small>Referans kaynak</small></div>
                <TextSide label={beforeLabel} value={null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} sub={resource.type} value={resource.name} />
              </li>
            ))}
            {diff.resources.removed.map((resource) => (
              <li className="removed" key={`res-removed-${resource.id}`}>
                <div><span className="diff-kind"><MinusCircle aria-hidden size={20} />Kaldırıldı</span><small>Referans kaynak</small></div>
                <TextSide label={beforeLabel} sub={resource.type} value={resource.name} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} value={null} />
              </li>
            ))}
            {diff.warnings.added.map((warning, index) => (
              <li className="changed" key={`warn-added-${index}`}>
                <div><span className="diff-kind"><PlusCircle aria-hidden size={20} />Yeni uyarı</span><small><code className="code">{warning.code}</code></small></div>
                <TextSide label={beforeLabel} value={null} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} value={warning.message} />
              </li>
            ))}
            {diff.warnings.removed.map((warning, index) => (
              <li className="added" key={`warn-removed-${index}`}>
                <div><span className="diff-kind"><CheckCircle aria-hidden size={20} />Çözüldü</span><small><code className="code">{warning.code}</code></small></div>
                <TextSide label={beforeLabel} value={warning.message} />
                <span className="diff-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
                <TextSide label={afterLabel} value={null} />
              </li>
            ))}
          </ul>
          <aside className="diff-summary" aria-label="Değişiklik özeti">
            <h3>Değişiklik özeti</h3>
            {counts.changed > 0 && <div className="diff-stat"><span className="mark locked"><ArrowsClockwise aria-hidden size={22} /></span><div><strong>{counts.changed}</strong><span>karar güncellendi</span></div></div>}
            {counts.added > 0 && <div className="diff-stat"><span className="mark success"><PlusCircle aria-hidden size={22} /></span><div><strong>{counts.added}</strong><span>karar eklendi</span></div></div>}
            {counts.removed > 0 && <div className="diff-stat"><span className="mark locked"><MinusCircle aria-hidden size={22} /></span><div><strong>{counts.removed}</strong><span>karar kaldırıldı</span></div></div>}
            {counts.rulesAdded > 0 && <div className="diff-stat"><span className="mark success"><PlusCircle aria-hidden size={22} /></span><div><strong>{counts.rulesAdded}</strong><span>kural eklendi</span></div></div>}
            {counts.rulesRemoved > 0 && <div className="diff-stat"><span className="mark locked"><MinusCircle aria-hidden size={22} /></span><div><strong>{counts.rulesRemoved}</strong><span>kural kaldırıldı</span></div></div>}
            {empty && <p className="muted">İki sürüm arasında anlamsal fark yok.</p>}
            <hr className="divider" style={{ margin: "4px 0" }} />
            <div>
              <h3 style={{ fontSize: 17 }}>Kaynaklar görünür</h3>
              <p className="status-label ok" style={{ whiteSpace: "normal", marginTop: 8, fontWeight: 400 }}><CheckCircle aria-hidden size={20} />Her değişiklik proje kararlarına ve Kütüphane kaynaklarına bağlıdır.</p>
            </div>
            <ul className="meta">
              {fromSummary && <li>v{fromSummary.version} oluşturulma: {formatDateTime(fromSummary.createdAt)}</li>}
              {toSummary && <li>v{toSummary.version} oluşturulma: {formatDateTime(toSummary.createdAt)}</li>}
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
  const router = useRouter();
  const [state, setState] = useState<ContextState | null>(initial);
  const [versions, setVersions] = useState(initialVersions);
  const [exports, setExports] = useState(initialExports);
  const [viewing, setViewing] = useState<ContextVersion | null>(initial?.version ?? null);
  const [raw, setRaw] = useState(false);
  const [tab, setTab] = useState<Tab>("agents");
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState<"compile" | "copy" | "download" | "bundle" | "view" | null>(null);
  const [notice, setNotice] = useState<string | null>(initial === null ? "Talimatlar yüklenemedi. Sayfayı yenileyip tekrar dene." : null);
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
        if (!(error instanceof DOMException && error.name === "AbortError")) setDiffResult({ error: "Karşılaştırma yüklenemedi. Tekrar dene." });
      }
    })();
    return () => controller.abort();
  }, [view, diffFrom, diffTo, project.id, versions.length]);

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
      setNotice(result.created ? `Sürüm ${result.version.version} oluşturuldu.` : `Sürüm ${result.version.version} sonrasında değişiklik yok.`);
      router.refresh();
    } catch {
      setNotice("Derleyiciye ulaşılamıyor. Tekrar dene.");
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
      setNotice("Sürüm yüklenemedi. Tekrar dene.");
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
      setNotice(`${downloadName(fileName)} kopyalandı (sürüm ${viewing.version}).`);
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : "Kopyalanamadı. Önizleme metnini seçip elle kopyala.");
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
      setNotice(`${downloadName(fileName)} indirildi (sürüm ${viewing.version}).`);
    } catch (error) {
      setNotice(error instanceof Error && error.message ? error.message : "İndirme başarısız. Tekrar dene.");
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
      setNotice(`${name} indirildi (sürüm ${viewing.version}).`);
      const history = await fetch(`/api/projects/${project.id}/exports`, { cache: "no-store" });
      if (history.ok) setExports(exportListResponseSchema.parse(await history.json()).exports);
    } catch {
      setNotice("Paket indirilemedi. Tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  const compileButton = (
    <button className={`button${current ? "" : " primary"}`} disabled={busy !== null} onClick={() => void compile()} type="button">
      <ArrowsClockwise aria-hidden size={18} />
      {busy === "compile" ? "Oluşturuluyor…" : current ? "Yeniden oluştur" : "Talimatları oluştur"}
    </button>
  );

  return (
    <section className="context-screen">
      {current && state?.stale && (
        <div className="readiness warn" role="status" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="icon"><ArrowsClockwise aria-hidden size={26} /></span>
            <div>
              <span className="status-label warn">Yenileme gerekli</span>
              <small>Son oluşturmadan sonra kararlar veya kurallar değişti. Yeniden oluşturarak sürüm {current.version + 1} yayınla.{state.draftWarnings.length > 0 ? ` Taslakta ${pluralCount(state.draftWarnings.length, "uyarı")} var.` : ""}</small>
            </div>
          </div>
          <button className="button primary" disabled={busy !== null} onClick={() => void compile()} type="button">{busy === "compile" ? "Oluşturuluyor…" : "Yeniden oluştur"}</button>
        </div>
      )}

      {viewing && viewing.canonical.warnings.length > 0 && view === "document" && (
        <section aria-labelledby="context-warnings" className="warning-panel" style={{ marginTop: 20 }}>
          <h3 id="context-warnings">Sürüm {viewing.version} için {pluralCount(viewing.canonical.warnings.length, "uyarı")}</h3>
          <ul>
            {viewing.canonical.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}><code>{warning.code}</code><span>{warning.message}</span></li>
            ))}
          </ul>
          <p>Uyarılar kararlarını değiştirmez. Teknoloji yığınında veya Kütüphane’de düzelt ve yeniden oluştur.</p>
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
          <aside aria-label="Proje kararları" className="source-rail">
            <div className="section-head">
              <h3>Proje kararları</h3>
              <Link className="text-link" href={`/workspace/projects/${project.id}/stack`} style={{ color: "var(--muted)" }}><PencilSimple aria-hidden size={18} /> Düzenle</Link>
            </div>
            <p className="lead">Talimatların bu tercihlerden oluşturuldu.</p>
            <ul className="source-list">
              {viewing.canonical.decisions.map((decision) => (
                <li key={decision.slot}>
                  <span className="mark">{decision.resource ? <TechLogo name={decision.resource.name} size={26} slug={catalogSlugFor(decision.resource)} /> : <Sparkle aria-hidden size={22} />}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong>{decision.resource?.name ?? slotLabel(decision.slot)}</strong>
                    <small>{decision.resource ? slotLabel(decision.slot) : originLabel(decision)}</small>
                  </div>
                  <DecisionBadge mode={decision.mode} />
                </li>
              ))}
              {viewing.canonical.decisions.length === 0 && <li><span className="muted">Bu sürümde karar yok.</span></li>}
            </ul>
            <h3 style={{ marginTop: 26 }}>Proje kuralları</h3>
            {viewing.canonical.rules.length > 0 ? (
              <ul className="source-rules">{viewing.canonical.rules.map((rule, index) => <li key={index}><ListBullets aria-hidden size={18} />{rule}</li>)}</ul>
            ) : <p className="muted small" style={{ marginTop: 10 }}>Bu sürüme eklenmiş kural yok.</p>}
            <p className="source-foot">Kaynak: Proje tercihleri ve Kütüphane · v{viewing.version}</p>
          </aside>

          <div className="doc-pane">
            <div className="doc-toolbar">
              <h3>AI talimatları</h3>
              <span className="chip mono">{downloadName(fileName)}</span>
              <span className="spacer" />
              <select aria-label="Coding agent" className="select inline" onChange={(event) => { const value = event.target.value; if (value === "diff") { setView("diff"); return; } setTab(value as Tab); }} value={tab}>
                {agentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                <option value="diff">Sürüm farkları</option>
              </select>
              <button className="button" disabled={busy !== null} onClick={() => void copy()} type="button"><Copy aria-hidden size={18} />{busy === "copy" ? "Kopyalanıyor…" : "Kopyala"}</button>
              <button className="button primary" disabled={busy !== null} onClick={() => void download()} type="button">{busy === "download" ? "Hazırlanıyor…" : "Dışa aktar"}<DownloadSimple aria-hidden size={18} /></button>
            </div>
            <div className="doc-subbar">
              {viewing.version === current?.version
                ? <ContextStatusLabel kind={statusKind} size={18} />
                : <ContextStatusLabel kind="none" label={`Sürüm ${viewing.version} görüntüleniyor`} size={18} />}
              <span>·</span>
              <span>Derleyici {viewing.compilerVersion}</span>
              <span>·</span>
              <span className="context-meta"><code>{viewing.contentHash.slice(0, 12)}</code></span>
              <span className="spacer" />
              {tab !== "canonical" && <button aria-pressed={raw} className="button small" onClick={() => setRaw(!raw)} type="button">{raw ? "Okuma görünümü" : "Ham metin"}</button>}
              <button className="button small" disabled={busy !== null} onClick={() => void downloadBundle()} type="button">{busy === "bundle" ? "Paketleniyor…" : "Tüm dosyalar (.zip)"}</button>
              {current && !state?.stale && <span className="button small" style={{ display: "contents" }}>{compileButton}</span>}
            </div>
            {current && viewing.version !== current.version && (
              <p className="note" role="status">
                Sürüm {viewing.version} görüntüleniyor. Güncel sürüm {current.version}.{" "}
                <button className="text-link" onClick={() => setViewing(current)} style={{ background: "none", border: 0, padding: 0 }} type="button">Güncel sürümü göster</button>
              </p>
            )}
            <div aria-label="Talimat önizlemesi" role="region">
              {raw || tab === "canonical"
                ? <pre className="raw-preview" tabIndex={0}>{content}</pre>
                : <article className="document"><Markdown disallowedElements={["img"]} skipHtml>{content}</Markdown></article>}
            </div>
            <p className="doc-foot">{formatDateTime(viewing.createdAt)} tarihinde oluşturuldu. İndirilen dosya derleyicinin özgün çıktısını içerir.</p>
            <aside className="context-side">
              <details>
                <summary><CaretDown aria-hidden size={16} />Sürüm ve dışa aktarma geçmişi</summary>
                <section aria-labelledby="version-history">
                  <h3 id="version-history">Sürümler</h3>
                  <ol className="version-list">
                    {versions.map((item) => (
                      <li key={item.id}>
                        <button aria-current={viewing.version === item.version ? "true" : undefined} className={viewing.version === item.version ? "active" : ""} disabled={busy !== null} onClick={() => void viewVersion(item.version)} type="button">
                          <strong>v{item.version}</strong>
                          <span>{formatDateTime(item.createdAt)}</span>
                          <small>{pluralCount(item.decisionCount, "karar")} · {pluralCount(item.warningCount, "uyarı")}</small>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
                <section aria-labelledby="export-history">
                  <h3 id="export-history">Dışa aktarma geçmişi</h3>
                  {exports.length === 0 ? (
                    <p className="muted small">Henüz dışa aktarım yok. Bir talimat dosyasını kopyala veya indir.</p>
                  ) : (
                    <ul className="export-list">
                      {exports.map((item) => (
                        <li key={item.id}><strong>{item.fileName}</strong><span>v{item.contextVersion ?? "?"} · {formatDateTime(item.createdAt)}</span></li>
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
          <h2>Henüz oluşturulmadı</h2>
          <p>Kütüphane kurallarını ve proje tercihlerini bir araya getirerek Codex, Claude Code, Cursor ve Copilot için hazır talimatlar üret.</p>
          {compileButton}
        </div>
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </section>
  );
}
