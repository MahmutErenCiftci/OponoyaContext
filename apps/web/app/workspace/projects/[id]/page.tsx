import type { Metadata } from "next";
import { ArrowRight, ArrowSquareOut, ArrowsClockwise, BookOpen, CaretRight, CheckCircle, Circle, Clock, Devices, ListChecks, Star, Target } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DecisionBadge } from "../../../../components/decision-badge";
import { TechLogo } from "../../../../components/tech-logo";
import { getAuditEvents, getContextStatuses, getProject, getProjectDecisions } from "../../../../lib/api";
import { activityDetail, activityLabel } from "../../../../lib/activity-labels";
import { contextStatusFrom } from "../../../../lib/context-status";
import { slotGroups, slotLabel } from "../../../../lib/decision-slots";
import { defineCopy } from "../../../../lib/i18n";
import { getLocale } from "../../../../lib/locale-server";
import { catalogSlugFor } from "../../../../lib/logos";
import { formatDate, formatTime, pluralCount, typeLabels } from "../../../../lib/resource-labels";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { ProjectHeader } from "./project-header";

const copy = defineCopy({
  tr: {
    title: "Proje",
    lead: "Henüz açıklama yok. Projeyi düzenleyerek amacını ekle.",
    goal: "Hedef",
    goalMissing: "Belirtilmedi. Projeyi düzenleyerek amacını yaz.",
    platforms: "Platformlar",
    notSpecified: "Belirtilmedi",
    priorities: "Öncelikler",
    recipeAndProfiles: "Kaynak tarif ve profiller",
    archivedSuffix: " · arşivde",
    noRecipe: "Tarif seçilmedi.",
    priority: "öncelik",
    rules: "Proje kuralları",
    noRules: "Kural eklenmedi.",
    references: "Referans kaynaklar",
    fresh: "AI talimatları güncel",
    stale: "AI talimatları yenilenmeli",
    none: "AI talimatları henüz oluşturulmadı",
    createWhenReady: "Kararlar hazır olduğunda oluştur.",
    open: "Talimatları aç",
    refresh: "Yenile",
    create: "Oluştur",
    stack: "Teknoloji yığını",
    decisions: (count: number) => pluralCount(count, "karar"),
    noDecisions: "Henüz karar yok. Teknoloji yığınında bir teknolojiyi kilitle, tercih et veya AI’a bırak.",
    aiDecides: "AI karar versin",
    openDecision: (slot: string) => `${slot} kararını aç`,
    openStack: "Teknoloji yığınını aç",
    activity: "Son etkinlikler",
    activityUnavailable: "Etkinlikler şu an yüklenemiyor.",
    noActivity: "Bu proje için henüz etkinlik yok.",
  },
  en: {
    title: "Project",
    lead: "No description yet. Edit the project to add its purpose.",
    goal: "Goal",
    goalMissing: "Not specified. Edit the project to describe its purpose.",
    platforms: "Platforms",
    notSpecified: "Not specified",
    priorities: "Priorities",
    recipeAndProfiles: "Source recipe and profiles",
    archivedSuffix: " · archived",
    noRecipe: "No recipe selected.",
    priority: "priority",
    rules: "Project rules",
    noRules: "No rules added.",
    references: "Reference resources",
    fresh: "AI instructions up to date",
    stale: "AI instructions need a refresh",
    none: "AI instructions not created yet",
    createWhenReady: "Create them once your decisions are ready.",
    open: "Open instructions",
    refresh: "Refresh",
    create: "Create",
    stack: "Tech stack",
    decisions: (count: number) => pluralCount(count, "decision", "decisions"),
    noDecisions: "No decisions yet. In the tech stack, lock a technology, prefer one or let AI decide.",
    aiDecides: "Let AI decide",
    openDecision: (slot: string) => `Open ${slot} decision`,
    openStack: "Open tech stack",
    activity: "Recent activity",
    activityUnavailable: "Activity cannot be loaded right now.",
    noActivity: "No activity for this project yet.",
  },
});

/** The entity name in the tab title; the lookup is shared with the page through the per-request cache. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await loadSession();
  const project = session.status === "authenticated" ? await getProject(session.cookieHeader, id) : null;
  return { title: project ? project.name : copy[await getLocale()].title };
}

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = copy[locale];
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  // One round trip: the API scopes every call to the owner, so a foreign id only yields nulls and `notFound()`.
  const [project, decisions, statuses, activity] = await Promise.all([
    getProject(cookieHeader, id),
    getProjectDecisions(cookieHeader, id),
    getContextStatuses(cookieHeader, [id]),
    getAuditEvents(cookieHeader, new URLSearchParams({ entityType: "project", entityId: id, limit: "4" })),
  ]);
  if (!project) notFound();
  const views = decisions ?? [];
  // The light status (no canonical parse, no rendered previews) is all this page shows.
  const status = contextStatusFrom(statuses.get(id));
  // Concrete picks first (the stack the agent will actually see), then delegated slots in catalog group order.
  const groups = slotGroups[locale];
  const groupOrder = (slot: string) => { const index = groups.findIndex((group) => group.slots.some((item) => item.key === slot)); return index === -1 ? groups.length : index; };
  const stack = views
    .filter((view) => view.effective.mode !== "DISABLED")
    .sort((a, b) => Number(Boolean(b.effective.resource)) - Number(Boolean(a.effective.resource)) || groupOrder(a.slot) - groupOrder(b.slot) || a.slot.localeCompare(b.slot))
    .slice(0, 6);
  const base = `/workspace/projects/${project.id}`;

  return (
    <WorkspaceShell active="Projects" user={user}>
      <section className="page">
        <ProjectHeader active="overview" lead={project.description ?? t.lead} project={project} />
        <div className="split overview" style={{ marginTop: 8 }}>
          <div className="project-brief">
            <div className="brief-item">
              <span className="mark"><Target aria-hidden size={30} /></span>
              <div><h3>{t.goal}</h3><p>{project.description ?? t.goalMissing}</p></div>
            </div>
            <div className="brief-item">
              <span className="mark"><Devices aria-hidden size={30} /></span>
              <div><h3>{t.platforms}</h3>{project.platforms.length > 0 ? <div className="chip-group">{project.platforms.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <p>{t.notSpecified}</p>}</div>
            </div>
            <div className="brief-item">
              <span className="mark"><Star aria-hidden size={30} /></span>
              <div><h3>{t.priorities}</h3>{project.priorities.length > 0 ? <div className="chip-group">{project.priorities.map((item) => <span className="chip" key={item}>{item}</span>)}</div> : <p>{t.notSpecified}</p>}</div>
            </div>
            <div className="brief-item">
              <span className="mark"><BookOpen aria-hidden size={30} /></span>
              <div>
                <h3>{t.recipeAndProfiles}</h3>
                {project.recipe
                  ? <p><Link className="text-link locked" href={`/workspace/recipes/${project.recipe.id}`}>{project.recipe.name} <ArrowSquareOut aria-hidden size={18} /></Link>{project.recipe.archivedAt ? <span className="muted">{t.archivedSuffix}</span> : null}</p>
                  : <p>{t.noRecipe}</p>}
                {project.profiles.length > 0 && (
                  <ul className="chip-group" style={{ marginTop: 10 }}>
                    {project.profiles.map((item) => <li key={item.id}><Link className="chip" href={`/workspace/profiles/${item.id}`}>{item.name} · {t.priority} {item.priority}</Link></li>)}
                  </ul>
                )}
              </div>
            </div>
            <div className="brief-item">
              <span className="mark"><ListChecks aria-hidden size={30} /></span>
              <div>
                <h3>{t.rules}</h3>
                {project.rules.length > 0 ? <ul className="rules">{project.rules.map((rule) => <li key={rule}>• {rule}</li>)}</ul> : <p>{t.noRules}</p>}
                {project.resources.length > 0 && (
                  <>
                    <h4 style={{ fontSize: 15, marginTop: 18, marginBottom: 8, color: "var(--muted)" }}>{t.references} ({project.resources.length})</h4>
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
                <span className="icon">{status.kind === "fresh" ? <CheckCircle aria-hidden size={32} /> : status.kind === "stale" ? <ArrowsClockwise aria-hidden size={30} /> : <Circle aria-hidden size={30} />}</span>
                <div style={{ minWidth: 0 }}>
                  <span className={`status-label ${status.kind === "fresh" ? "ok" : status.kind === "stale" ? "warn" : "none"}`} style={{ color: "var(--ink)" }}>{status.kind === "fresh" ? t.fresh : status.kind === "stale" ? t.stale : t.none}</span>
                  <small>{status.version ? `v${status.version} · ${status.createdAt ? formatDate(status.createdAt, locale) : ""}` : t.createWhenReady}</small>
                </div>
              </div>
              <Link className="button primary" href={`${base}/context`}>{status.kind === "fresh" ? t.open : status.kind === "stale" ? t.refresh : t.create} <ArrowRight aria-hidden size={18} /></Link>
            </div>
            <section className="card" aria-labelledby="stack-card-title">
              <div className="section-head" style={{ marginBottom: 6 }}>
                <h3 id="stack-card-title">{t.stack}</h3>
                <span className="muted small">{t.decisions(views.length)}</span>
              </div>
              {stack.length === 0 ? (
                <p className="muted small">{t.noDecisions}</p>
              ) : (
                <ul className="list-rows">
                  {stack.map((view) => (
                    <li key={view.slot}>
                      <span className="mark">{view.effective.resource ? <TechLogo name={view.effective.resource.name} size={26} slug={catalogSlugFor(view.effective.resource)} /> : <DecisionBadge label="" mode={view.effective.mode} size={20} />}</span>
                      <div className="grow">
                        <strong>{view.effective.resource?.name ?? t.aiDecides}</strong>
                        <small>{slotLabel(view.slot, locale)}{view.effective.resource && typeLabels[locale][view.effective.resource.type] !== slotLabel(view.slot, locale) ? ` · ${typeLabels[locale][view.effective.resource.type]}` : ""}</small>
                      </div>
                      <Link aria-label={t.openDecision(slotLabel(view.slot, locale))} className="icon-button" href={`${base}/stack`}><CaretRight aria-hidden size={18} /></Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link className="text-link" href={`${base}/stack`} style={{ marginTop: 12, color: "var(--ink)" }}>{t.openStack} <ArrowRight aria-hidden size={16} /></Link>
            </section>
            <section className="card" aria-labelledby="project-activity-title">
              <h3 id="project-activity-title">{t.activity}</h3>
              {activity === null ? <p className="muted small">{t.activityUnavailable}</p> : activity.length === 0 ? <p className="muted small">{t.noActivity}</p> : (
                <ul className="list-rows">
                  {activity.map((event) => (
                    <li key={event.id}>
                      <span className="mark small"><Clock aria-hidden size={18} /></span>
                      <div className="grow"><strong style={{ fontSize: 15 }}>{activityLabel(event, locale)}</strong>{activityDetail(event, locale) && <small>{activityDetail(event, locale)}</small>}</div>
                      <small className="muted nowrap">{formatDate(event.createdAt, locale)} · {formatTime(event.createdAt, locale)}</small>
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
