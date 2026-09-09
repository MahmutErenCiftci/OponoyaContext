import { ArrowRight, ArrowSquareOut, ArrowsClockwise, BookOpen, CaretRight, CheckCircle, Circle, Clock, Devices, ListChecks, Star, Target } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DecisionBadge } from "../../../../components/decision-badge";
import { TechLogo } from "../../../../components/tech-logo";
import { getAuditEvents, getProject, getProjectContext, getProjectDecisions } from "../../../../lib/api";
import { activityDetail, activityLabel } from "../../../../lib/activity-labels";
import { contextStatus } from "../../../../lib/context-status";
import { slotGroups, slotLabel } from "../../../../lib/decision-slots";
import { catalogSlugFor } from "../../../../lib/logos";
import { formatDate, formatTime, pluralCount, typeLabels } from "../../../../lib/resource-labels";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { ProjectHeader } from "./project-header";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const project = await getProject(cookieHeader, id);
  if (!project) notFound();
  const [decisions, context, activity] = await Promise.all([
    getProjectDecisions(cookieHeader, id),
    getProjectContext(cookieHeader, id),
    getAuditEvents(cookieHeader, new URLSearchParams({ entityType: "project", entityId: id, limit: "4" })),
  ]);
  const views = decisions ?? [];
  const status = contextStatus(context);
  // Concrete picks first (the stack the agent will actually see), then delegated slots in catalog group order.
  const groupOrder = (slot: string) => { const index = slotGroups.findIndex((group) => group.slots.some((item) => item.key === slot)); return index === -1 ? slotGroups.length : index; };
  const stack = views
    .filter((view) => view.effective.mode !== "DISABLED")
    .sort((a, b) => Number(Boolean(b.effective.resource)) - Number(Boolean(a.effective.resource)) || groupOrder(a.slot) - groupOrder(b.slot) || a.slot.localeCompare(b.slot))
    .slice(0, 6);
  const base = `/workspace/projects/${project.id}`;

  return (
    <WorkspaceShell active="Projects" user={user}>
      <section className="page">
        <ProjectHeader active="overview" lead={project.description ?? "Henüz açıklama yok. Projeyi düzenleyerek amacını ekle."} project={project} />
        <div className="split overview" style={{ marginTop: 8 }}>
          <div className="project-brief">
            <div className="brief-item">
              <span className="mark"><Target size={30} /></span>
              <div><h3>Hedef</h3><p>{project.description ?? "Belirtilmedi. Projeyi düzenleyerek amacını yaz."}</p></div>
            </div>
            <div className="brief-item">
              <span className="mark"><Devices size={30} /></span>
              <div><h3>Platformlar</h3>{project.platforms.length > 0 ? <div className="chip-group">{project.platforms.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <p>Belirtilmedi</p>}</div>
            </div>
            <div className="brief-item">
              <span className="mark"><Star size={30} /></span>
              <div><h3>Öncelikler</h3>{project.priorities.length > 0 ? <div className="chip-group">{project.priorities.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <p>Belirtilmedi</p>}</div>
            </div>
            <div className="brief-item">
              <span className="mark"><BookOpen size={30} /></span>
              <div>
                <h3>Kaynak tarif ve profiller</h3>
                {project.recipe
                  ? <p><Link className="text-link locked" href={`/workspace/recipes/${project.recipe.id}`}>{project.recipe.name} <ArrowSquareOut aria-hidden size={18} /></Link>{project.recipe.archivedAt ? <span className="muted"> · arşivde</span> : null}</p>
                  : <p>Tarif seçilmedi.</p>}
                {project.profiles.length > 0 && (
                  <ul className="chip-group" style={{ marginTop: 10 }}>
                    {project.profiles.map((item) => <li key={item.id}><Link className="chip" href={`/workspace/profiles/${item.id}`}>{item.name} · öncelik {item.priority}</Link></li>)}
                  </ul>
                )}
              </div>
            </div>
            <div className="brief-item">
              <span className="mark"><ListChecks size={30} /></span>
              <div>
                <h3>Proje kuralları</h3>
                {project.rules.length > 0 ? <ul className="rules">{project.rules.map((rule) => <li key={rule}>• {rule}</li>)}</ul> : <p>Kural eklenmedi.</p>}
                {project.resources.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 15, marginTop: 18, marginBottom: 8, color: "var(--muted)" }}>Referans kaynaklar ({project.resources.length})</h4>
                    <ul className="chip-group">
                      {project.resources.map((resource) => <li key={resource.id}>{resource.sourceUrl ? <a className="chip" href={resource.sourceUrl} rel="noreferrer" target="_blank">{resource.name} <ArrowSquareOut aria-hidden size={14} /></a> : <span className="chip">{resource.name}</span>}</li>)}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
          <aside className="rail" style={{ marginTop: 28 }}>
            <div className={`readiness ${status.kind === "fresh" ? "" : status.kind === "stale" ? "warn" : "none"}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <span className="icon">{status.kind === "fresh" ? <CheckCircle size={32} /> : status.kind === "stale" ? <ArrowsClockwise size={30} /> : <Circle size={30} />}</span>
                <div style={{ minWidth: 0 }}>
                  <span className={`status-label ${status.kind === "fresh" ? "ok" : status.kind === "stale" ? "warn" : "none"}`} style={{ color: "var(--ink)" }}>{status.kind === "fresh" ? "AI talimatları güncel" : status.kind === "stale" ? "AI talimatları yenilenmeli" : "AI talimatları henüz oluşturulmadı"}</span>
                  <small>{status.version ? `v${status.version} · ${status.createdAt ? formatDate(status.createdAt) : ""}` : "Kararlar hazır olduğunda oluştur."}</small>
                </div>
              </div>
              <Link className="button primary" href={`${base}/context`}>{status.kind === "fresh" ? "Talimatları aç" : status.kind === "stale" ? "Yenile" : "Oluştur"} <ArrowRight aria-hidden size={18} /></Link>
            </div>
            <section className="card" aria-labelledby="stack-card-title">
              <div className="section-head" style={{ marginBottom: 6 }}>
                <h3 id="stack-card-title">Teknoloji yığını</h3>
                <span className="muted small">{pluralCount(views.length, "karar")}</span>
              </div>
              {stack.length === 0 ? (
                <p className="muted small">Henüz karar yok. Teknoloji yığınında bir teknolojiyi kilitle, tercih et veya AI’a bırak.</p>
              ) : (
                <ul className="list-rows">
                  {stack.map((view) => (
                    <li key={view.slot}>
                      <span className="mark">{view.effective.resource ? <TechLogo name={view.effective.resource.name} size={26} slug={catalogSlugFor(view.effective.resource)} /> : <DecisionBadge label="" mode={view.effective.mode} size={20} />}</span>
                      <div className="grow">
                        <strong>{view.effective.resource?.name ?? "AI karar versin"}</strong>
                        <small>{slotLabel(view.slot)}{view.effective.resource && typeLabels[view.effective.resource.type] !== slotLabel(view.slot) ? ` · ${typeLabels[view.effective.resource.type]}` : ""}</small>
                      </div>
                      <Link aria-label={`${slotLabel(view.slot)} kararını aç`} className="icon-button" href={`${base}/stack`}><CaretRight aria-hidden size={18} /></Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link className="text-link" href={`${base}/stack`} style={{ marginTop: 12, color: "var(--ink)" }}>Teknoloji yığınını aç <ArrowRight aria-hidden size={16} /></Link>
            </section>
            <section className="card" aria-labelledby="project-activity-title">
              <h3 id="project-activity-title">Son etkinlikler</h3>
              {activity === null ? <p className="muted small">Etkinlikler şu an yüklenemiyor.</p> : activity.length === 0 ? <p className="muted small">Bu proje için henüz etkinlik yok.</p> : (
                <ul className="list-rows">
                  {activity.map((event) => (
                    <li key={event.id}>
                      <span className="mark small"><Clock size={18} /></span>
                      <div className="grow"><strong style={{ fontSize: 15 }}>{activityLabel(event)}</strong>{activityDetail(event) && <small>{activityDetail(event)}</small>}</div>
                      <small className="muted nowrap">{formatDate(event.createdAt)} · {formatTime(event.createdAt)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </section>
    </WorkspaceShell>
  );
}
