import type { Metadata } from "next";
import type { AuditEvent, CatalogSuggestions, Project, Resource, ResourceType } from "@devcontext/contracts";
import { ArrowRight, Check, ClockCounterClockwise, Compass, FolderSimplePlus, Lightning, Megaphone, Plus, SignIn, Stack } from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuditPresence, getCatalogSuggestions, getContextStatuses, getProjectList, getResourceList, getWorkspaceSettings, getWorkspaceSummary } from "../../lib/api";
import { activityHref, activityLabel } from "../../lib/activity-labels";
import { announcementKindLabels, announcements, bannerCookieName } from "../../lib/announcements";
import { contextStatusFrom } from "../../lib/context-status";
import { Carousel } from "../../components/carousel";
import { ContextStatusLabel } from "../../components/status-label";
import { TechLogo } from "../../components/tech-logo";
import { catalogSlugFor } from "../../lib/logos";
import { displayTimeZone, formatDate, stageLabels, typeLabels } from "../../lib/resource-labels";
import { loadSession } from "../../lib/server-session";
import { AnnouncementBanner } from "./announcement-banner";
import { FirstRunPanel } from "./first-run-panel";
import { LiveClock } from "./live-clock";
import { ServiceUnavailable } from "./unavailable";
import { WorkspaceShell } from "./workspace-shell";

export const metadata: Metadata = { title: "Genel bakış" };

const signInFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: displayTimeZone });
const newsDateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const relative = new Intl.RelativeTimeFormat("tr-TR", { numeric: "auto" });

/** "3 saat önce", "dün", "2 gün önce". */
function timeAgo(iso: string, now: number) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.35], ["month", 12], ["year", Infinity]];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return unit === "second" ? "az önce" : relative.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}

type RecentTechnology = { id: string; name: string; type: ResourceType; slug: string | null; projects: number };

/** Rules, prompts and references are Library entries but not technologies. */
const nonTechnologyTypes = new Set<ResourceType>(["rule", "prompt", "reference"]);

/** Sample entries are named "Sample · X"; cards show X and keep the full name as a tooltip. */
function displayName(name: string) {
  return name.replace(/^sample\s*·\s*/i, "") || name;
}

/** Technologies of the most recently updated Projects first, then the rest of the Library; each counted once. */
function recentTechnologies(projects: Project[], library: Resource[]): RecentTechnology[] {
  const byId = new Map(library.map((resource) => [resource.id, resource]));
  const recent = new Map<string, RecentTechnology>();
  for (const project of projects) {
    for (const reference of project.resources) {
      if (reference.archivedAt || nonTechnologyTypes.has(reference.type)) continue;
      const entry = recent.get(reference.id) ?? { id: reference.id, name: reference.name, type: reference.type, slug: catalogSlugFor(byId.get(reference.id) ?? reference), projects: 0 };
      entry.projects += 1;
      recent.set(reference.id, entry);
    }
  }
  for (const resource of library) {
    if (!recent.has(resource.id) && !nonTechnologyTypes.has(resource.type)) recent.set(resource.id, { id: resource.id, name: resource.name, type: resource.type, slug: catalogSlugFor(resource), projects: 0 });
  }
  return [...recent.values()].slice(0, 16);
}

function lastActivityText(event: AuditEvent, projects: Project[]) {
  const project = event.entityType === "project" ? projects.find((item) => item.id === event.entityId) : undefined;
  return project ? `${activityLabel(event)} · ${project.name}` : activityLabel(event);
}

function ProjectCard({ project, status }: { project: Project; status: ReturnType<typeof contextStatusFrom> }) {
  const techs = project.resources.filter((item) => !item.archivedAt);
  return (
    <Link className="overview-card project-card" draggable={false} href={`/workspace/projects/${project.id}`}>
      <div className="card-top">
        <span className="mark tone project-initial">{displayName(project.name).slice(0, 1).toUpperCase()}</span>
        <span className={`chip stage stage-${project.stage}`}>{stageLabels[project.stage]}</span>
      </div>
      <strong className="card-title">{project.name}</strong>
      <p className="card-text">{project.description ?? project.productType ?? "Açıklama eklenmemiş."}</p>
      <div className="logo-row" aria-label={`${techs.length} teknoloji`}>
        {techs.slice(0, 5).map((item) => <span className="logo-chip" key={item.id} title={item.name}><TechLogo name={item.name} size={20} slug={catalogSlugFor(item)} /></span>)}
        {techs.length > 5 && <span className="logo-more">+{techs.length - 5}</span>}
        {techs.length === 0 && <span className="muted small">Henüz teknoloji yok</span>}
      </div>
      <div className="card-foot">
        <ContextStatusLabel kind={status.kind} label={status.kind === "fresh" ? "Bağlam güncel" : undefined} />
        <small className="muted">{formatDate(project.updatedAt)}</small>
      </div>
    </Link>
  );
}

function suggestionCards(suggestions: CatalogSuggestions) {
  return [
    ...suggestions.stacks.map(({ stack, matched }) => (
      <Link className="overview-card suggestion-card" draggable={false} href={`/workspace/catalog/stacks/${stack.slug}`} key={`stack-${stack.slug}`}>
        <div className="card-top">
          <span className="mark tone"><Stack aria-hidden size={22} /></span>
          <span className="chip stage-experiment">Hazır stack</span>
        </div>
        <strong className="card-title">{stack.name}</strong>
        <p className="card-text">{stack.summary}</p>
        <div className="logo-row">
          {stack.highlights.slice(0, 5).map((item) => <span className="logo-chip" key={item.slug} title={item.name ?? item.slug}><TechLogo name={item.name ?? item.slug} size={20} slug={item.slug} /></span>)}
        </div>
        <div className="card-foot">
          <span className="reason"><Lightning aria-hidden size={16} weight="fill" />{matched > 0 ? `${matched} / ${stack.technologyCount} teknolojin bu stack’te` : "Başlangıç için iyi bir seçim"}</span>
        </div>
      </Link>
    )),
    ...suggestions.technologies.map(({ technology, reason, because }) => (
      <Link className="overview-card suggestion-card" draggable={false} href={`/workspace/catalog/${technology.slug}`} key={`tech-${technology.slug}`}>
        <div className="card-top">
          <span className="mark plain"><TechLogo name={technology.name} size={28} slug={technology.slug} /></span>
          <span className="chip">{technology.category}</span>
        </div>
        <strong className="card-title">{technology.name}</strong>
        <p className="card-text">{technology.summary}</p>
        <div className="card-foot">
          <span className="reason"><Lightning aria-hidden size={16} weight="fill" />{because.map((item) => item.name ?? item.slug).join(", ")} {reason === "pairs_with" ? "ile sık kullanılır" : "alternatifi"}</span>
        </div>
      </Link>
    )),
  ];
}

export default async function WorkspacePage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [summary, projects, settings, library, presence, suggestions, cookieStore] = await Promise.all([
    getWorkspaceSummary(cookieHeader),
    getProjectList(cookieHeader, new URLSearchParams({ status: "active", limit: "12" })),
    getWorkspaceSettings(cookieHeader),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "40" })),
    getAuditPresence(cookieHeader),
    getCatalogSuggestions(cookieHeader),
    cookies(),
  ]);
  const statuses = projects ? await getContextStatuses(cookieHeader, projects.projects.map((project) => project.id)) : new Map();
  const counts = summary ?? { resources: 0, favorites: 0, projects: projects?.total ?? 0, profiles: 0, compiledProjects: 0, contextVersions: 0, exports: 0 };
  const checklist = [
    { id: "resources", label: "Kütüphanene beş kaynak ekle", progress: `${Math.min(counts.resources, 5)}/5`, done: counts.resources >= 5, href: "/workspace/library?add=1", action: "Kaynak ekle" },
    { id: "project", label: "İlk projeni oluştur", progress: `${Math.min(counts.projects, 1)}/1`, done: counts.projects >= 1, href: "/workspace/projects?new=1", action: "Yeni proje" },
    { id: "compile", label: "AI talimatlarını oluştur", progress: `${Math.min(counts.compiledProjects, 1)}/1`, done: counts.compiledProjects >= 1, href: "/workspace/projects", action: "Bir proje aç" },
    { id: "export", label: "Bir coding agent’a aktar", progress: `${Math.min(counts.exports, 1)}/1`, done: counts.exports >= 1, href: "/workspace/projects", action: "Bir proje aç" },
  ];
  const doneCount = checklist.filter((item) => item.done).length;
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const firstRun = settings?.onboardingState === "new";
  const showCompactFirstRun = settings?.onboardingState === "in_progress";
  // A first visit has no earlier sign-in: the "last time" lines stay hidden until there is one.
  const returning = presence?.previousSignInAt != null;
  const lastActivity = returning && presence?.lastActivity && presence.lastActivity.action !== "account.created" ? presence.lastActivity : null;
  const lastActivityHref = lastActivity ? activityHref(lastActivity) : null;
  // Server component: rendered once per request, so the request time is stable.
  const now = new Date().getTime();
  const featured = announcements[0];
  const showBanner = featured !== undefined && cookieStore.get(bannerCookieName)?.value !== featured.id;
  const technologies = library ? recentTechnologies(projects?.projects ?? [], library.resources) : [];

  return (
    <WorkspaceShell active="Overview" user={user}>
      <section className="page overview-page">
        {showBanner && featured && <AnnouncementBanner announcement={featured} />}

        <header className="overview-hero">
          <div className="overview-hero-text">
            <LiveClock initial={new Date(now).toISOString()} />
            <h1>{returning ? "Tekrar hoş geldin" : "Hoş geldin"}, {firstName}</h1>
            {returning && presence?.previousSignInAt ? (
              <ul aria-label="Son ziyaretin" className="overview-meta">
                <li><SignIn aria-hidden size={18} />Son girişin: <time dateTime={presence.previousSignInAt}>{signInFormat.format(new Date(presence.previousSignInAt))}</time></li>
                {lastActivity && (
                  <li>
                    <ClockCounterClockwise aria-hidden size={18} />En son:{" "}
                    {lastActivityHref ? <Link href={lastActivityHref}>{lastActivityText(lastActivity, projects?.projects ?? [])}</Link> : lastActivityText(lastActivity, projects?.projects ?? [])}
                    <span className="muted"> · {timeAgo(lastActivity.createdAt, now)}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="page-lead">Projelerin, teknolojilerin ve AI talimatların burada bir arada.</p>
            )}
          </div>
          <span aria-hidden="true" className="overview-hero-art"><span /><span /><span /></span>
        </header>

        {summary === null && <p className="note warning" role="status">Çalışma alanı sayıları yüklenemedi. Aşağıdaki bilgiler eksik olabilir; yenileyip tekrar dene.</p>}

        {firstRun && settings ? <FirstRunPanel settings={settings} /> : (
          <>
            {showCompactFirstRun && settings && <FirstRunPanel settings={settings} />}
            {doneCount < checklist.length && (
              <section aria-labelledby="checklist-title" className="checklist-panel">
                <h2 id="checklist-title">Kurulum: {doneCount} / {checklist.length} tamamlandı</h2>
                <ol aria-label="Kurulum adımları" className="checklist">
                  {checklist.map((item) => (
                    <li className={item.done ? "done" : ""} key={item.id}>
                      <span aria-hidden="true" className="mark">{item.done ? <Check aria-hidden size={14} weight="bold" /> : null}</span>
                      <div>
                        <strong>{item.label}</strong>
                        {item.done ? <small>Tamamlandı</small> : <Link href={item.href}>{item.action} · {item.progress}</Link>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {projects === null ? (
              <section className="overview-section"><h2 className="section-title">Projelerin</h2><p className="muted" role="status">Projeler şu an yüklenemedi. Sayfayı yenileyerek tekrar dene.</p></section>
            ) : (
              <Carousel
                action={projects.total > 0 ? <Link className="text-link locked" href="/workspace/projects">Tüm projeler <ArrowRight aria-hidden size={18} /></Link> : undefined}
                perView={3}
                title="Projelerin"
                titleId="overview-projects"
              >
                {[
                  ...projects.projects.map((project) => <ProjectCard key={project.id} project={project} status={contextStatusFrom(statuses.get(project.id))} />),
                  <Link className="overview-card new-card" draggable={false} href="/workspace/projects?new=1" key="new-project">
                    <span className="mark large tone"><FolderSimplePlus aria-hidden size={30} /></span>
                    <strong className="card-title">{projects.total === 0 ? "İlk projeni oluştur" : "Yeni proje"}</strong>
                    <p className="card-text">Kütüphanendeki tercihleri bir projede toplayıp AI talimatlarını oluştur.</p>
                    <span className="button small"><Plus aria-hidden size={16} />Başla</span>
                  </Link>,
                ]}
              </Carousel>
            )}

            {library === null ? (
              <section className="overview-section"><h2 className="section-title">Son kullandığın teknolojiler</h2><p className="muted" role="status">Kütüphane şu an yüklenemedi. Sayfayı yenileyerek tekrar dene.</p></section>
            ) : technologies.length === 0 ? (
              <section className="overview-section">
                <h2 className="section-title">Son kullandığın teknolojiler</h2>
                <p className="muted">Henüz teknoloji yok. <Link className="text-link" href="/workspace/library?add=1">İlk kaynağını ekle</Link> veya <Link className="text-link" href="/workspace/catalog">kataloğa göz at</Link>.</p>
              </section>
            ) : (
              <Carousel
                action={<Link className="text-link locked" href="/workspace/library">Kütüphane <ArrowRight aria-hidden size={18} /></Link>}
                perView={4}
                title="Son kullandığın teknolojiler"
                titleId="overview-technologies"
              >
                {technologies.map((item) => (
                  <Link className="overview-card tech-card" draggable={false} href={`/workspace/library?q=${encodeURIComponent(item.name)}`} key={item.id}>
                    <span className="mark plain"><TechLogo name={item.name} size={30} slug={item.slug} /></span>
                    <span className="tech-card-text" title={item.name}>
                      <strong>{displayName(item.name)}</strong>
                      <small>{typeLabels[item.type]}</small>
                    </span>
                    <span className={`tech-usage${item.projects > 0 ? " used" : ""}`}>{item.projects > 0 ? `${item.projects} projede` : "Kütüphanede"}</span>
                  </Link>
                ))}
              </Carousel>
            )}

            {suggestions === null ? (
              <section className="overview-section"><h2 className="section-title">Senin için öneriler</h2><p className="muted" role="status">Öneriler şu an yüklenemedi.</p></section>
            ) : suggestions.stacks.length + suggestions.technologies.length > 0 && (
              <>
                <Carousel
                  action={<Link className="text-link locked" href="/workspace/catalog"><Compass aria-hidden size={18} />Kataloğu keşfet</Link>}
                  perView={3}
                  title="Senin için öneriler"
                  titleId="overview-suggestions"
                >
                  {suggestionCards(suggestions)}
                </Carousel>
                <p className="muted small overview-footnote">Öneriler, kütüphanendeki teknolojilere ve katalogdaki editör değerlendirmelerine göre hazırlanır; sen eklemedikçe kütüphanene hiçbir şey eklenmez.</p>
              </>
            )}
          </>
        )}

        <section aria-labelledby="overview-news" className="overview-section news" id="yenilikler">
          <div className="section-head">
            <h2 className="section-title" id="overview-news"><Megaphone aria-hidden size={22} />Yenilikler</h2>
          </div>
          <ol aria-label="Sürüm notları ve duyurular" className="news-list">
            {announcements.map((item) => (
              <li className={`news-item ${item.kind}`} key={item.id}>
                <div className="news-meta">
                  <span className={`news-kind ${item.kind}`}>{announcementKindLabels[item.kind]}</span>
                  {item.version && <span className="chip mono">{item.version}</span>}
                  <time dateTime={item.date}>{newsDateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
                </div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                {item.href && <Link className="text-link" href={item.href}>Göz at <ArrowRight aria-hidden size={16} /></Link>}
              </li>
            ))}
          </ol>
        </section>
      </section>
    </WorkspaceShell>
  );
}
