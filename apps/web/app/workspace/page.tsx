import type { AuditEvent } from "@devcontext/contracts";
import { ArrowRight, Check, Clock, Database, FileText, Plus, UploadSimple, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuditEvents, getProjectContext, getProjectList, getResourceList, getWorkspaceSettings, getWorkspaceSummary } from "../../lib/api";
import { activityDetail, activityHref, activityLabel } from "../../lib/activity-labels";
import { contextStatus } from "../../lib/context-status";
import { DecisionBadge } from "../../components/decision-badge";
import { ContextStatusLabel } from "../../components/status-label";
import { TechLogo } from "../../components/tech-logo";
import { catalogSlugFor } from "../../lib/logos";
import { formatDate, formatDateTime, typeLabels } from "../../lib/resource-labels";
import { loadSession } from "../../lib/server-session";
import { FirstRunPanel } from "./first-run-panel";
import { ServiceUnavailable } from "./unavailable";
import { WorkspaceShell } from "./workspace-shell";

export const dynamic = "force-dynamic";

function ActivityIcon({ event }: { event: AuditEvent }) {
  if (event.action.endsWith("exported")) return <UploadSimple size={22} />;
  if (event.action.includes("decision")) return <Database size={22} />;
  if (event.entityType === "profile" || event.entityType === "recipe") return <FileText size={22} />;
  if (event.entityType === "account") return <UserCircle size={22} />;
  return <Check size={22} />;
}

export default async function WorkspacePage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [summary, projects, activity, settings, library] = await Promise.all([
    getWorkspaceSummary(cookieHeader),
    getProjectList(cookieHeader, new URLSearchParams({ status: "active", limit: "3" })),
    getAuditEvents(cookieHeader, new URLSearchParams({ limit: "5" })),
    getWorkspaceSettings(cookieHeader),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "4" })),
  ]);
  const contexts = await Promise.all(projects.projects.map((project) => getProjectContext(cookieHeader, project.id)));
  const counts = summary ?? { resources: 0, favorites: 0, projects: projects.total, profiles: 0, compiledProjects: 0, contextVersions: 0, exports: 0 };
  const checklist = [
    { id: "resources", label: "Kütüphanene beş kaynak ekle", progress: `${Math.min(counts.resources, 5)}/5`, done: counts.resources >= 5, href: "/workspace/library?add=1", action: "Kaynak ekle" },
    { id: "project", label: "İlk projeni oluştur", progress: `${Math.min(counts.projects, 1)}/1`, done: counts.projects >= 1, href: "/workspace/projects?new=1", action: "Yeni proje" },
    { id: "compile", label: "AI talimatlarını oluştur", progress: `${Math.min(counts.compiledProjects, 1)}/1`, done: counts.compiledProjects >= 1, href: "/workspace/projects", action: "Bir proje aç" },
    { id: "export", label: "Bir coding agent’a aktar", progress: `${Math.min(counts.exports, 1)}/1`, done: counts.exports >= 1, href: "/workspace/projects", action: "Bir proje aç" },
  ];
  const doneCount = checklist.filter((item) => item.done).length;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const showFirstRun = settings !== null && (settings.onboardingState === "new" || settings.onboardingState === "in_progress");

  return (
    <WorkspaceShell active="Overview" user={user}>
      <section className="page">
        {settings?.onboardingState === "new" ? (
          <>
            <h1 className="visually-hidden">Merhaba, {firstName}</h1>
            <FirstRunPanel settings={settings} />
          </>
        ) : (
          <>
            <header className="dashboard-greeting">
              <div>
                <h1>Merhaba, {firstName}</h1>
                <p className="page-lead">Projelerin ve AI talimatların bir arada.</p>
              </div>
              <Link className="button primary large" href="/workspace/projects?new=1"><Plus aria-hidden size={20} />Yeni proje</Link>
            </header>
            {summary === null && <p className="note warning" role="status" style={{ marginTop: 20 }}>Çalışma alanı sayıları yüklenemedi. Aşağıdaki bilgiler eksik olabilir; yenileyip tekrar dene.</p>}
            {showFirstRun && settings && <FirstRunPanel settings={settings} />}
            {doneCount < checklist.length && (
              <section aria-labelledby="checklist-title" className="checklist-panel">
                <h2 id="checklist-title">Kurulum: {doneCount} / {checklist.length} tamamlandı</h2>
                <ol aria-label="Kurulum adımları" className="checklist">
                  {checklist.map((item) => (
                    <li className={item.done ? "done" : ""} key={item.id}>
                      <span aria-hidden="true" className="mark">{item.done ? <Check size={14} weight="bold" /> : null}</span>
                      <div>
                        <strong>{item.label}</strong>
                        {item.done ? <small>Tamamlandı</small> : <Link href={item.href}>{item.action} · {item.progress}</Link>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <div className="dashboard-grid">
              <section aria-labelledby="recent-title">
                <div className="section-head">
                  <h2 className="section-title" id="recent-title">Kaldığın yerden devam et</h2>
                  {projects.total > 0 && <Link className="text-link locked" href="/workspace/projects">Tüm projeler <ArrowRight aria-hidden size={18} /></Link>}
                </div>
                {projects.projects.length === 0 ? (
                  <div className="empty">
                    <span className="mark xl"><FileText size={34} /></span>
                    <h2 style={{ fontSize: 20 }}>Henüz proje yok</h2>
                    <p>Kütüphanendeki tercihleri bir araya getirmek için ilk projeni oluştur.</p>
                    <Link className="button primary" href="/workspace/projects?new=1">Yeni proje</Link>
                  </div>
                ) : (
                  <div className="table-wrap" style={{ marginTop: 0 }}>
                    <table className="table">
                      <thead><tr><th scope="col">Proje</th><th scope="col">Teknolojiler</th><th scope="col">Durum</th><th scope="col">Son güncelleme</th><th className="actions" scope="col">İşlem</th></tr></thead>
                      <tbody>
                        {projects.projects.map((project, index) => {
                          const status = contextStatus(contexts[index] ?? null);
                          const techs = project.resources.slice(0, 3);
                          return (
                            <tr key={project.id}>
                              <td>
                                <div className="identity">
                                  <span className="mark tone" style={{ fontWeight: 700, fontSize: 18 }}>{project.name.replace(/^sample\s*·\s*/i, "").slice(0, 1).toUpperCase()}</span>
                                  <strong><Link href={`/workspace/projects/${project.id}`}>{project.name}</Link></strong>
                                </div>
                              </td>
                              <td className="muted" data-label="Teknolojiler">{techs.length > 0 ? techs.map((item) => item.name).join(" · ") : "Kaynak bağlı değil"}</td>
                              <td data-label="Durum"><ContextStatusLabel kind={status.kind} label={status.kind === "fresh" ? "Bağlam güncel" : undefined} /></td>
                              <td className="muted" data-label="Son güncelleme">{status.createdAt ? formatDate(status.createdAt) : "—"}</td>
                              <td className="actions"><Link className="text-link" href={`/workspace/projects/${project.id}`} style={{ color: "var(--ink)" }}>Projeyi aç <ArrowRight aria-hidden size={18} /></Link></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <aside aria-labelledby="activity-title">
                <h2 className="section-title" id="activity-title" style={{ marginBottom: 20 }}>Son etkinlikler</h2>
                {activity === null ? (
                  <p className="note warning" role="status">Etkinlikler şu an yüklenemiyor. Yenileyip tekrar dene.</p>
                ) : activity.length === 0 ? (
                  <p className="muted">Kaydettiğin kaynaklar, kararlar ve dışa aktarımlar burada görünür.</p>
                ) : (
                  <ol aria-label="Son etkinlikler" className="timeline">
                    {activity.map((event) => {
                      const detail = activityDetail(event);
                      const href = activityHref(event);
                      const title = <>{activityLabel(event)}{detail ? <span className="muted"> · {detail}</span> : null}</>;
                      return (
                        <li key={event.id}>
                          <span className="mark"><ActivityIcon event={event} /></span>
                          <div>
                            <strong>{href ? <Link href={href}>{title}</Link> : title}</strong>
                            <small><Clock aria-hidden size={16} /><time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time></small>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </aside>
            </div>
            <hr className="divider" />
            <section aria-labelledby="library-title">
              <div className="section-head">
                <h2 className="section-title" id="library-title">Kütüphanenden</h2>
                <Link className="text-link locked" href="/workspace/library">Kütüphaneyi aç <ArrowRight aria-hidden size={18} /></Link>
              </div>
              {library.resources.length === 0 ? (
                <p className="muted">Henüz kaynak yok. <Link className="text-link" href="/workspace/library?add=1">İlk kaynağını ekle</Link> veya <Link className="text-link" href="/workspace/catalog">kataloğa göz at</Link>.</p>
              ) : (
                <div className="library-strip">
                  {library.resources.map((resource) => (
                    <Link href={`/workspace/library?q=${encodeURIComponent(resource.name)}`} key={resource.id}>
                      <span className="mark"><TechLogo name={resource.name} size={26} slug={catalogSlugFor(resource)} /></span>
                      <span className="grow"><strong style={{ display: "block", fontWeight: 600 }}>{resource.name}</strong><small className="muted">{typeLabels[resource.type]}</small></span>
                      {resource.preference ? <DecisionBadge label="" mode={resource.preference.mode} size={20} /> : null}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </WorkspaceShell>
  );
}
