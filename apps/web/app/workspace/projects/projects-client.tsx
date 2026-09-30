"use client";

import { Archive, ArrowCounterClockwise, ArrowRight, FolderSimple, MagnifyingGlass, PencilSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import {
  projectContextStatusResponseSchema,
  projectDecisionsResponseSchema,
  projectListResponseSchema,
  projectStageSchema,
  type DecisionRecord,
  type ProfileSummary,
  type Project,
  type ProjectDecisionView,
  type RecipeSummary,
  type Resource,
} from "@devcontext/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { ContextStatusLabel } from "../../../components/status-label";
import { TechLogo } from "../../../components/tech-logo";
import { contextStatusFrom, type ContextStatus } from "../../../lib/context-status";
import { responseError } from "../../../lib/errors";
import { catalogSlugFor } from "../../../lib/logos";
import { formatDateTime, stageLabels } from "../../../lib/resource-labels";
import { ProjectWizard } from "./project-wizard";

type StatusView = "active" | "archived";

/** Rows per request, matching the server-rendered first page; the API caps a page at 100. */
const pageSize = 50;
type Editor = { kind: "closed" } | { kind: "create" } | { kind: "edit"; project: Project };

function ProjectRow({ project, status, onEdit, onArchive, onRestore }: {
  project: Project;
  status: ContextStatus | null;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
}) {
  const archived = project.status === "archived";
  const techs = project.resources.slice(0, 3);
  return (
    <tr className={archived ? "archived" : ""}>
      <td>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 20, letterSpacing: "-.02em" }}><Link href={`/workspace/projects/${project.id}`}>{project.name}</Link></h3>
          <small className="muted" style={{ display: "block", marginTop: 4 }}>{project.description || project.productType || "Henüz açıklama yok."}</small>
        </div>
      </td>
      <td data-label="Teknolojiler">
        {techs.length > 0
          ? <div className="inline-logos">{techs.map((item) => <span key={item.id}><span className="mark small plain"><TechLogo name={item.name} size={22} slug={catalogSlugFor(item)} /></span>{item.name}</span>)}{project.resources.length > 3 && <span className="muted">+{project.resources.length - 3}</span>}</div>
          : <span className="muted">—</span>}
      </td>
      <td data-label="Aşama"><span className={`chip stage stage-${project.stage}`}>{stageLabels[project.stage]}</span>{archived && <span className="chip" style={{ marginLeft: 6 }}>Arşivlendi</span>}</td>
      <td data-label="AI bağlamı">{status ? <ContextStatusLabel kind={status.kind} label={status.kind === "fresh" ? `Güncel v${status.version}` : undefined} /> : <span className="muted">…</span>}</td>
      <td className="muted nowrap" data-label="Güncellendi">{formatDateTime(project.updatedAt)}</td>
      <td className="actions">
        <div className="row-actions">
          <RowMenu label={`${project.name} işlemleri`}>
            {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />Düzenle</button>}
            {archived
              ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />Geri yükle</button>
              : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />Arşivle</button>}
          </RowMenu>
          <Link aria-label={`${project.name} projesini aç`} className="icon-button" href={`/workspace/projects/${project.id}`}><ArrowRight aria-hidden size={22} /></Link>
        </div>
      </td>
    </tr>
  );
}

export function ProjectsClient({ initial, initialStatuses, library, profiles, recipes, globalDecisions, openCreateOnLoad, initialRecipeId, editOnLoad, editDecisions }: {
  initial: { projects: Project[]; total: number };
  initialStatuses: Record<string, ContextStatus>;
  library: Resource[];
  profiles: ProfileSummary[];
  recipes: RecipeSummary[];
  globalDecisions: DecisionRecord[];
  openCreateOnLoad: boolean;
  initialRecipeId: string | null;
  editOnLoad: Project | null;
  editDecisions: ProjectDecisionView[];
}) {
  const [editorDecisions, setEditorDecisions] = useState<ProjectDecisionView[]>(editDecisions);
  const router = useRouter();
  const [projects, setProjects] = useState(initial.projects);
  const [total, setTotal] = useState(initial.total);
  const [statuses, setStatuses] = useState<Record<string, ContextStatus>>(initialStatuses);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState<StatusView>("active");
  const [editor, setEditor] = useState<Editor>(editOnLoad ? { kind: "edit", project: editOnLoad } : openCreateOnLoad ? { kind: "create" } : { kind: "closed" });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  /** One batch request refreshes the freshness of every listed project, so edits show up immediately. */
  async function loadStatuses(items: Project[]) {
    if (items.length === 0) return;
    try {
      const params = new URLSearchParams({ ids: items.slice(0, 50).map((item) => item.id).join(",") });
      const response = await fetch(`/api/projects/context-status?${params}`, { cache: "no-store" });
      if (!response.ok) return;
      const parsed = projectContextStatusResponseSchema.safeParse(await response.json());
      if (!parsed.success) return;
      const byId = new Map(parsed.data.statuses.map((item) => [item.projectId, item]));
      setStatuses((previous) => ({ ...previous, ...Object.fromEntries(items.map((item) => [item.id, contextStatusFrom(byId.get(item.id))])) }));
    } catch {
      // Keep the last known statuses; the next list load retries.
    }
  }

  function listParams(values: { search: string; status: StatusView; stage: string }) {
    const params = new URLSearchParams({ status: values.status, limit: String(pageSize) });
    if (values.search) params.set("q", values.search);
    if (values.stage) params.set("stage", values.stage);
    return params;
  }

  async function load(next: { search?: string; status?: StatusView; stage?: string } = {}) {
    const values = { search: next.search ?? search, status: next.status ?? status, stage: next.stage ?? stage };
    const params = listParams(values);
    setLoading(true);
    try {
      const response = await fetch(`/api/projects?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load projects");
      const result = projectListResponseSchema.parse(await response.json());
      setProjects(result.projects);
      setTotal(result.total);
      void loadStatuses(result.projects);
    } catch {
      setNotice("Projeler yenilenemedi.");
    } finally {
      setLoading(false);
    }
  }

  /** Appends the next page; rows already listed are not repeated. */
  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const params = listParams({ search, status, stage });
      params.set("offset", String(projects.length));
      const response = await fetch(`/api/projects?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load projects");
      const result = projectListResponseSchema.parse(await response.json());
      const seen = new Set(projects.map((item) => item.id));
      const added = result.projects.filter((item) => !seen.has(item.id));
      setProjects((previous) => [...previous, ...added]);
      setTotal(result.total);
      void loadStatuses(added);
    } catch {
      setNotice("Daha fazla proje yüklenemedi. Tekrar dene.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function mutate(project: Project, action: "archive" | "restore") {
    if (busyId) return;
    setBusyId(project.id);
    try {
      const response = await fetch(`/api/projects/${project.id}${action === "restore" ? "/restore" : ""}`, { method: action === "restore" ? "POST" : "DELETE" });
      if (!response.ok) {
        setNotice(await responseError(response));
        return;
      }
      setNotice(action === "restore" ? `${project.name} geri yüklendi.` : `${project.name} arşive taşındı. Bağlı Kütüphane kaynaklarına dokunulmadı.`);
      await load();
    } catch {
      setNotice("Proje hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setBusyId(null);
    }
  }

  function clearQueryString() {
    if (window.location.search) router.replace("/workspace/projects");
  }

  function closeEditor() {
    setEditor({ kind: "closed" });
    clearQueryString();
  }

  function handleSaved(project: Project) {
    if (editor.kind === "create") {
      router.push(`/workspace/projects/${project.id}`);
      return;
    }
    setEditor({ kind: "closed" });
    clearQueryString();
    setNotice(`${project.name} kaydedildi.`);
    void load();
  }

  async function openEditor(project: Project) {
    try {
      const response = await fetch(`/api/projects/${project.id}/decisions`, { cache: "no-store" });
      setEditorDecisions(response.ok ? projectDecisionsResponseSchema.parse(await response.json()).decisions : []);
    } catch {
      setEditorDecisions([]);
    }
    setEditor({ kind: "edit", project });
  }

  if (editor.kind !== "closed") {
    return (
      <section className="page">
        <ProjectWizard
          decisions={editor.kind === "edit" ? editorDecisions : []}
          globalDecisions={globalDecisions}
          initialRecipeId={editor.kind === "create" ? initialRecipeId : null}
          key={editor.kind === "edit" ? editor.project.id : "create"}
          library={library}
          onClose={closeEditor}
          onSaved={handleSaved}
          profiles={profiles}
          project={editor.kind === "edit" ? editor.project : null}
          recipes={recipes}
        />
        {notice && <div className="toast" role="status">{notice}</div>}
      </section>
    );
  }

  const filtered = Boolean(search || stage);
  const emptyTitle = status === "archived" ? "Arşiv boş" : filtered ? "Aramana uygun proje bulunamadı" : "İlk projeni oluştur";

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor({ kind: "create" })} type="button"><Plus aria-hidden size={20} />Yeni proje</button>}
        lead="Her proje için tek ve güncel bir bağlam."
        title="Projeler"
      />
      <div className="tab-row">
        <div aria-label="Proje durumu" className="tabs" role="tablist">
          <button aria-selected={status === "active"} onClick={() => { setStatus("active"); void load({ status: "active" }); }} role="tab" type="button">Aktif{status === "active" ? ` (${total})` : ""}</button>
          <button aria-selected={status === "archived"} onClick={() => { setStatus("archived"); void load({ status: "archived" }); }} role="tab" type="button">Arşiv</button>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search" style={{ width: 300 }}>
            <MagnifyingGlass aria-hidden size={20} />
            <input aria-label="Projelerde ara" onChange={(event) => setSearch(event.target.value)} placeholder="Projelerde ara" value={search} />
          </form>
          <select aria-label="Aşamaya göre filtrele" className="select inline" onChange={(event) => { setStage(event.target.value); void load({ stage: event.target.value }); }} value={stage}>
            <option value="">Tüm aşamalar</option>
            {projectStageSchema.options.map((option) => <option key={option} value={option}>{stageLabels[option]}</option>)}
          </select>
        </div>
      </div>
      {projects.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table aria-label="Projeler" className="table bordered">
            <thead><tr><th scope="col">Proje</th><th scope="col">Teknolojiler</th><th scope="col">Aşama</th><th scope="col">AI bağlamı</th><th scope="col">Güncellendi</th><th className="actions" scope="col"><span className="visually-hidden">İşlemler</span></th></tr></thead>
            <tbody>
              {projects.map((project) => (
                <ProjectRow key={project.id} onArchive={() => void mutate(project, "archive")} onEdit={() => void openEditor(project)} onRestore={() => void mutate(project, "restore")} project={project} status={statuses[project.id] ?? null} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && projects.length > 0 && projects.length < total && (
        <div className="load-more">
          <button className="button" disabled={loadingMore} onClick={() => void loadMore()} type="button">
            {loadingMore ? "Yükleniyor…" : `Daha fazla göster (${total - projects.length} kaldı)`}
          </button>
        </div>
      )}
      {!loading && projects.length === 0 && (
        <div className="empty">
          <span className="mark xl"><FolderSimple aria-hidden size={34} /></span>
          <h2>{emptyTitle}</h2>
          <p>
            {status === "archived"
              ? "Arşivlenen projeler burada kurtarılabilir kalır. Bağlı Kütüphane kaynakları asla silinmez."
              : filtered ? "Başka bir sözcük dene ya da filtreleri temizle."
                : library.length > 0 ? "Kayıtlı kaynaklarını coding agent’ların izleyeceği bir proje bağlamına dönüştür." : "Bir proje bilgisiyle başla. Kütüphane kaynaklarını şimdi bağlayabilir ya da sonra ekleyebilirsin."}
          </p>
          {status === "active" && !filtered && <button className="button primary" onClick={() => setEditor({ kind: "create" })} type="button">İlk projeni oluştur</button>}
          {filtered && <button className="button" onClick={() => { setSearch(""); setStage(""); void load({ search: "", stage: "" }); }} type="button">Filtreleri temizle</button>}
        </div>
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </section>
  );
}
