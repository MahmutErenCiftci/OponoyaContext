"use client";

import { Archive, ArrowCounterClockwise, ArrowRight, FolderSimple, MagnifyingGlass, PencilSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import {
  projectContextStatusResponseSchema,
  projectDecisionsResponseSchema,
  projectListResponseSchema,
  projectStageSchema,
  type CatalogSlotSuggestions,
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
import { useLocale } from "../../../components/locale-provider";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { ContextStatusLabel } from "../../../components/status-label";
import { TechLogo } from "../../../components/tech-logo";
import { contextStatusFrom, type ContextStatus } from "../../../lib/context-status";
import { responseError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { catalogSlugFor } from "../../../lib/logos";
import { formatDateTime, stageLabels } from "../../../lib/resource-labels";
import { ProjectWizard } from "./project-wizard";

const copy = defineCopy({
  tr: {
    noDescription: "Henüz açıklama yok.",
    technologies: "Teknolojiler",
    stage: "Aşama",
    archivedChip: "Arşivlendi",
    aiContext: "AI bağlamı",
    freshVersion: (version: number | null) => `Güncel v${version}`,
    updated: "Güncellendi",
    rowActions: (name: string) => `${name} işlemleri`,
    edit: "Düzenle",
    restore: "Geri yükle",
    archive: "Arşivle",
    open: (name: string) => `${name} projesini aç`,
    refreshFailed: "Projeler yenilenemedi.",
    loadMoreFailed: "Daha fazla proje yüklenemedi. Tekrar dene.",
    restored: (name: string) => `${name} geri yüklendi.`,
    archived: (name: string) => `${name} arşive taşındı. Bağlı Kütüphane kaynaklarına dokunulmadı.`,
    unreachable: "Proje hizmetine ulaşılamıyor. Tekrar dene.",
    saved: (name: string) => `${name} kaydedildi.`,
    emptyArchive: "Arşiv boş",
    emptyFiltered: "Aramana uygun proje bulunamadı",
    emptyFirst: "İlk projeni oluştur",
    newProject: "Yeni proje",
    lead: "Her proje için tek ve güncel bir bağlam.",
    title: "Projeler",
    statusTabs: "Proje durumu",
    active: "Aktif",
    archiveTab: "Arşiv",
    search: "Projelerde ara",
    stageFilter: "Aşamaya göre filtrele",
    allStages: "Tüm aşamalar",
    project: "Proje",
    actions: "İşlemler",
    loading: "Yükleniyor…",
    showMore: (left: number) => `Daha fazla göster (${left} kaldı)`,
    archiveText: "Arşivlenen projeler burada kurtarılabilir kalır. Bağlı Kütüphane kaynakları asla silinmez.",
    filteredText: "Başka bir sözcük dene ya da filtreleri temizle.",
    libraryText: "Kayıtlı kaynaklarını coding agent’ların izleyeceği bir proje bağlamına dönüştür.",
    startText: "Bir proje bilgisiyle başla. Kütüphane kaynaklarını şimdi bağlayabilir ya da sonra ekleyebilirsin.",
    clearFilters: "Filtreleri temizle",
  },
  en: {
    noDescription: "No description yet.",
    technologies: "Technologies",
    stage: "Stage",
    archivedChip: "Archived",
    aiContext: "AI context",
    freshVersion: (version: number | null) => `Up to date v${version}`,
    updated: "Updated",
    rowActions: (name: string) => `${name} actions`,
    edit: "Edit",
    restore: "Restore",
    archive: "Archive",
    open: (name: string) => `Open project ${name}`,
    refreshFailed: "Projects could not be refreshed.",
    loadMoreFailed: "More projects could not be loaded. Try again.",
    restored: (name: string) => `${name} restored.`,
    archived: (name: string) => `${name} moved to the archive. Attached Library resources were not touched.`,
    unreachable: "The project service cannot be reached. Try again.",
    saved: (name: string) => `${name} saved.`,
    emptyArchive: "The archive is empty",
    emptyFiltered: "No projects match your search",
    emptyFirst: "Create your first project",
    newProject: "New project",
    lead: "One up-to-date context for every project.",
    title: "Projects",
    statusTabs: "Project status",
    active: "Active",
    archiveTab: "Archive",
    search: "Search projects",
    stageFilter: "Filter by stage",
    allStages: "All stages",
    project: "Project",
    actions: "Actions",
    loading: "Loading…",
    showMore: (left: number) => `Show more (${left} left)`,
    archiveText: "Archived projects stay recoverable here. Attached Library resources are never deleted.",
    filteredText: "Try another word or clear the filters.",
    libraryText: "Turn your saved resources into a project context your coding agents follow.",
    startText: "Start with the project details. You can attach Library resources now or add them later.",
    clearFilters: "Clear filters",
  },
});

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
  const locale = useLocale();
  const t = copy[locale];
  const archived = project.status === "archived";
  const techs = project.resources.slice(0, 3);
  return (
    <tr className={archived ? "archived" : ""}>
      <td>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 20, letterSpacing: "-.02em" }}><Link href={`/workspace/projects/${project.id}`}>{project.name}</Link></h3>
          <small className="muted" style={{ display: "block", marginTop: 4 }}>{project.description || project.productType || t.noDescription}</small>
        </div>
      </td>
      <td data-label={t.technologies}>
        {techs.length > 0
          ? <div className="inline-logos">{techs.map((item) => <span key={item.id}><span className="mark small plain"><TechLogo name={item.name} size={22} slug={catalogSlugFor(item)} /></span>{item.name}</span>)}{project.resources.length > 3 && <span className="muted">+{project.resources.length - 3}</span>}</div>
          : <span className="muted">—</span>}
      </td>
      <td data-label={t.stage}><span className={`chip stage stage-${project.stage}`}>{stageLabels[locale][project.stage]}</span>{archived && <span className="chip" style={{ marginLeft: 6 }}>{t.archivedChip}</span>}</td>
      <td data-label={t.aiContext}>{status ? <ContextStatusLabel kind={status.kind} label={status.kind === "fresh" ? t.freshVersion(status.version) : undefined} /> : <span className="muted">…</span>}</td>
      <td className="muted nowrap" data-label={t.updated}>{formatDateTime(project.updatedAt, locale)}</td>
      <td className="actions">
        <div className="row-actions">
          <RowMenu label={t.rowActions(project.name)}>
            {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />{t.edit}</button>}
            {archived
              ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />{t.restore}</button>
              : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />{t.archive}</button>}
          </RowMenu>
          <Link aria-label={t.open(project.name)} className="icon-button" href={`/workspace/projects/${project.id}`}><ArrowRight aria-hidden size={22} /></Link>
        </div>
      </td>
    </tr>
  );
}

export function ProjectsClient({ initial, initialStatuses, library, profiles, recipes, globalDecisions, openCreateOnLoad, initialRecipeId, editOnLoad, editDecisions, suggestions }: {
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
  suggestions: CatalogSlotSuggestions | null;
}) {
  const locale = useLocale();
  const t = copy[locale];
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
      setNotice(t.refreshFailed);
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
      setNotice(t.loadMoreFailed);
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
      setNotice(action === "restore" ? t.restored(project.name) : t.archived(project.name));
      await load();
    } catch {
      setNotice(t.unreachable);
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
    setNotice(t.saved(project.name));
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
          suggestions={suggestions}
        />
        {notice && <div className="toast" role="status">{notice}</div>}
      </section>
    );
  }

  const filtered = Boolean(search || stage);
  const emptyTitle = status === "archived" ? t.emptyArchive : filtered ? t.emptyFiltered : t.emptyFirst;

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor({ kind: "create" })} type="button"><Plus aria-hidden size={20} />{t.newProject}</button>}
        lead={t.lead}
        title={t.title}
      />
      <div className="tab-row">
        <div aria-label={t.statusTabs} className="tabs" role="tablist">
          <button aria-selected={status === "active"} onClick={() => { setStatus("active"); void load({ status: "active" }); }} role="tab" type="button">{t.active}{status === "active" ? ` (${total})` : ""}</button>
          <button aria-selected={status === "archived"} onClick={() => { setStatus("archived"); void load({ status: "archived" }); }} role="tab" type="button">{t.archiveTab}</button>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search" style={{ width: 300 }}>
            <MagnifyingGlass aria-hidden size={20} />
            <input aria-label={t.search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} value={search} />
          </form>
          <select aria-label={t.stageFilter} className="select inline" onChange={(event) => { setStage(event.target.value); void load({ stage: event.target.value }); }} value={stage}>
            <option value="">{t.allStages}</option>
            {projectStageSchema.options.map((option) => <option key={option} value={option}>{stageLabels[locale][option]}</option>)}
          </select>
        </div>
      </div>
      {projects.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 20 }}>
          <table aria-label={t.title} className="table bordered">
            <thead><tr><th scope="col">{t.project}</th><th scope="col">{t.technologies}</th><th scope="col">{t.stage}</th><th scope="col">{t.aiContext}</th><th scope="col">{t.updated}</th><th className="actions" scope="col"><span className="visually-hidden">{t.actions}</span></th></tr></thead>
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
            {loadingMore ? t.loading : t.showMore(total - projects.length)}
          </button>
        </div>
      )}
      {!loading && projects.length === 0 && (
        <div className="empty">
          <span className="mark xl"><FolderSimple aria-hidden size={34} /></span>
          <h2>{emptyTitle}</h2>
          <p>
            {status === "archived"
              ? t.archiveText
              : filtered ? t.filteredText
                : library.length > 0 ? t.libraryText : t.startText}
          </p>
          {status === "active" && !filtered && <button className="button primary" onClick={() => setEditor({ kind: "create" })} type="button">{t.emptyFirst}</button>}
          {filtered && <button className="button" onClick={() => { setSearch(""); setStage(""); void load({ search: "", stage: "" }); }} type="button">{t.clearFilters}</button>}
        </div>
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </section>
  );
}
