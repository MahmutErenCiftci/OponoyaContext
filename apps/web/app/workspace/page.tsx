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
import { defineCopy, intlLocales, type Locale } from "../../lib/i18n";
import { getLocale } from "../../lib/locale-server";
import { catalogSlugFor } from "../../lib/logos";
import { displayTimeZone, formatDate, stageLabels, typeLabels } from "../../lib/resource-labels";
import { loadSession } from "../../lib/server-session";
import { AnnouncementBanner } from "./announcement-banner";
import { FirstRunPanel } from "./first-run-panel";
import { LiveClock } from "./live-clock";
import { ServiceUnavailable } from "./unavailable";
import { WorkspaceShell } from "./workspace-shell";

const copy = defineCopy({
  tr: {
    metaTitle: "Genel bakış",
    justNow: "az önce",
    noDescription: "Açıklama eklenmemiş.",
    technologyCount: (count: number) => `${count} teknoloji`,
    noTechnologies: "Henüz teknoloji yok",
    contextFresh: "Bağlam güncel",
    readyStack: "Hazır stack",
    stackMatch: (matched: number, total: number) => `${matched} / ${total} teknolojin bu stack’te`,
    goodStart: "Başlangıç için iyi bir seçim",
    pairsWith: (names: string) => `${names} ile sık kullanılır`,
    alternativeTo: (names: string) => `${names} alternatifi`,
    checklist: {
      resources: "Kütüphanene beş kaynak ekle",
      project: "İlk projeni oluştur",
      compile: "AI talimatlarını oluştur",
      export: "Bir coding agent’a aktar",
    },
    actionAddResource: "Kaynak ekle",
    actionNewProject: "Yeni proje",
    actionOpenProject: "Bir proje aç",
    welcomeBack: "Tekrar hoş geldin",
    welcome: "Hoş geldin",
    lastVisit: "Son ziyaretin",
    lastSignIn: "Son girişin: ",
    latest: "En son:",
    heroLead: "Projelerin, teknolojilerin ve AI talimatların burada bir arada.",
    countsFailed: "Çalışma alanı sayıları yüklenemedi. Aşağıdaki bilgiler eksik olabilir; yenileyip tekrar dene.",
    setupTitle: (done: number, total: number) => `Kurulum: ${done} / ${total} tamamlandı`,
    setupSteps: "Kurulum adımları",
    done: "Tamamlandı",
    yourProjects: "Projelerin",
    projectsFailed: "Projeler şu an yüklenemedi. Sayfayı yenileyerek tekrar dene.",
    allProjects: "Tüm projeler",
    createFirstProject: "İlk projeni oluştur",
    newProject: "Yeni proje",
    newProjectText: "Kütüphanendeki tercihleri bir projede toplayıp AI talimatlarını oluştur.",
    start: "Başla",
    recentTechnologies: "Son kullandığın teknolojiler",
    libraryFailed: "Kütüphane şu an yüklenemedi. Sayfayı yenileyerek tekrar dene.",
    noTechnologiesYet: "Henüz teknoloji yok.",
    addFirstResource: "İlk kaynağını ekle",
    or: "veya",
    browseCatalog: "kataloğa göz at",
    library: "Kütüphane",
    inProjects: (count: number) => `${count} projede`,
    inLibrary: "Kütüphanede",
    suggestions: "Senin için öneriler",
    suggestionsFailed: "Öneriler şu an yüklenemedi.",
    exploreCatalog: "Kataloğu keşfet",
    suggestionsFootnote: "Öneriler, kütüphanendeki teknolojilere ve katalogdaki editör değerlendirmelerine göre hazırlanır; sen eklemedikçe kütüphanene hiçbir şey eklenmez.",
    news: "Yenilikler",
    newsLabel: "Sürüm notları ve duyurular",
    takeALook: "Göz at",
  },
  en: {
    metaTitle: "Overview",
    justNow: "just now",
    noDescription: "No description yet.",
    technologyCount: (count: number) => `${count} ${count === 1 ? "technology" : "technologies"}`,
    noTechnologies: "No technologies yet",
    contextFresh: "Context up to date",
    readyStack: "Ready-made stack",
    stackMatch: (matched: number, total: number) => `You already use ${matched} of its ${total} technologies`,
    goodStart: "A good place to start",
    pairsWith: (names: string) => `Often used with ${names}`,
    alternativeTo: (names: string) => `Alternative to ${names}`,
    checklist: {
      resources: "Add five resources to your Library",
      project: "Create your first project",
      compile: "Generate the AI instructions",
      export: "Hand them to a coding agent",
    },
    actionAddResource: "Add resource",
    actionNewProject: "New project",
    actionOpenProject: "Open a project",
    welcomeBack: "Welcome back",
    welcome: "Welcome",
    lastVisit: "Your last visit",
    lastSignIn: "Last sign-in: ",
    latest: "Latest:",
    heroLead: "Your projects, technologies and AI instructions, all in one place.",
    countsFailed: "Workspace counts could not be loaded. The details below may be incomplete; refresh and try again.",
    setupTitle: (done: number, total: number) => `Setup: ${done} / ${total} done`,
    setupSteps: "Setup steps",
    done: "Done",
    yourProjects: "Your projects",
    projectsFailed: "Projects could not be loaded right now. Refresh the page to try again.",
    allProjects: "All projects",
    createFirstProject: "Create your first project",
    newProject: "New project",
    newProjectText: "Bring the choices in your Library together in a project and generate its AI instructions.",
    start: "Start",
    recentTechnologies: "Recently used technologies",
    libraryFailed: "The Library could not be loaded right now. Refresh the page to try again.",
    noTechnologiesYet: "No technologies yet.",
    addFirstResource: "Add your first resource",
    or: "or",
    browseCatalog: "browse the catalog",
    library: "Library",
    inProjects: (count: number) => `In ${count} ${count === 1 ? "project" : "projects"}`,
    inLibrary: "In Library",
    suggestions: "Suggestions for you",
    suggestionsFailed: "Suggestions could not be loaded right now.",
    exploreCatalog: "Explore the catalog",
    suggestionsFootnote: "Suggestions are based on the technologies in your Library and the editors' assessments in the catalog; nothing is added to your Library unless you add it.",
    news: "What's new",
    newsLabel: "Release notes and announcements",
    takeALook: "Take a look",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].metaTitle };
}

function overviewFormats(locale: Locale) {
  return {
    signIn: new Intl.DateTimeFormat(intlLocales[locale], { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: displayTimeZone }),
    newsDate: new Intl.DateTimeFormat(intlLocales[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    relative: new Intl.RelativeTimeFormat(intlLocales[locale], { numeric: "auto" }),
  };
}

const formats: Record<Locale, ReturnType<typeof overviewFormats>> = { tr: overviewFormats("tr"), en: overviewFormats("en") };

/** "3 saat önce", "dün", "2 gün önce" / "3 hours ago", "yesterday", "2 days ago". */
function timeAgo(iso: string, now: number, locale: Locale) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.35], ["month", 12], ["year", Infinity]];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return unit === "second" ? copy[locale].justNow : formats[locale].relative.format(Math.round(value), unit);
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

function lastActivityText(event: AuditEvent, projects: Project[], locale: Locale) {
  const project = event.entityType === "project" ? projects.find((item) => item.id === event.entityId) : undefined;
  return project ? `${activityLabel(event, locale)} · ${project.name}` : activityLabel(event, locale);
}

function ProjectCard({ project, status, locale }: { project: Project; status: ReturnType<typeof contextStatusFrom>; locale: Locale }) {
  const t = copy[locale];
  const techs = project.resources.filter((item) => !item.archivedAt);
  return (
    <Link className="overview-card project-card" draggable={false} href={`/workspace/projects/${project.id}`}>
      <div className="card-top">
        <span className="mark tone project-initial">{displayName(project.name).slice(0, 1).toUpperCase()}</span>
        <span className={`chip stage stage-${project.stage}`}>{stageLabels[locale][project.stage]}</span>
      </div>
      <strong className="card-title">{project.name}</strong>
      <p className="card-text">{project.description ?? project.productType ?? t.noDescription}</p>
      <div className="logo-row" aria-label={t.technologyCount(techs.length)}>
        {techs.slice(0, 5).map((item) => <span className="logo-chip" key={item.id} title={item.name}><TechLogo name={item.name} size={20} slug={catalogSlugFor(item)} /></span>)}
        {techs.length > 5 && <span className="logo-more">+{techs.length - 5}</span>}
        {techs.length === 0 && <span className="muted small">{t.noTechnologies}</span>}
      </div>
      <div className="card-foot">
        <ContextStatusLabel kind={status.kind} label={status.kind === "fresh" ? t.contextFresh : undefined} />
        <small className="muted">{formatDate(project.updatedAt, locale)}</small>
      </div>
    </Link>
  );
}

function suggestionCards(suggestions: CatalogSuggestions, locale: Locale) {
  const t = copy[locale];
  return [
    ...suggestions.stacks.map(({ stack, matched }) => (
      <Link className="overview-card suggestion-card" draggable={false} href={`/workspace/catalog/stacks/${stack.slug}`} key={`stack-${stack.slug}`}>
        <div className="card-top">
          <span className="mark tone"><Stack aria-hidden size={22} /></span>
          <span className="chip stage-experiment">{t.readyStack}</span>
        </div>
        <strong className="card-title">{stack.name}</strong>
        <p className="card-text">{stack.summary}</p>
        <div className="logo-row">
          {stack.highlights.slice(0, 5).map((item) => <span className="logo-chip" key={item.slug} title={item.name ?? item.slug}><TechLogo name={item.name ?? item.slug} size={20} slug={item.slug} /></span>)}
        </div>
        <div className="card-foot">
          <span className="reason"><Lightning aria-hidden size={16} weight="fill" />{matched > 0 ? t.stackMatch(matched, stack.technologyCount) : t.goodStart}</span>
        </div>
      </Link>
    )),
    ...suggestions.technologies.map(({ technology, reason, because }) => {
      const names = because.map((item) => item.name ?? item.slug).join(", ");
      return (
        <Link className="overview-card suggestion-card" draggable={false} href={`/workspace/catalog/${technology.slug}`} key={`tech-${technology.slug}`}>
          <div className="card-top">
            <span className="mark plain"><TechLogo name={technology.name} size={28} slug={technology.slug} /></span>
            <span className="chip">{technology.category}</span>
          </div>
          <strong className="card-title">{technology.name}</strong>
          <p className="card-text">{technology.summary}</p>
          <div className="card-foot">
            <span className="reason"><Lightning aria-hidden size={16} weight="fill" />{reason === "pairs_with" ? t.pairsWith(names) : t.alternativeTo(names)}</span>
          </div>
        </Link>
      );
    }),
  ];
}

export default async function WorkspacePage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [summary, projects, settings, library, presence, suggestions, cookieStore, locale] = await Promise.all([
    getWorkspaceSummary(cookieHeader),
    getProjectList(cookieHeader, new URLSearchParams({ status: "active", limit: "12" })),
    getWorkspaceSettings(cookieHeader),
    getResourceList(cookieHeader, new URLSearchParams({ archived: "active", limit: "40" })),
    getAuditPresence(cookieHeader),
    getCatalogSuggestions(cookieHeader),
    cookies(),
    getLocale(),
  ]);
  const t = copy[locale];
  const statuses = projects ? await getContextStatuses(cookieHeader, projects.projects.map((project) => project.id)) : new Map();
  const counts = summary ?? { resources: 0, favorites: 0, projects: projects?.total ?? 0, profiles: 0, compiledProjects: 0, contextVersions: 0, exports: 0 };
  const checklist = [
    { id: "resources", label: t.checklist.resources, progress: `${Math.min(counts.resources, 5)}/5`, done: counts.resources >= 5, href: "/workspace/library?add=1", action: t.actionAddResource },
    { id: "project", label: t.checklist.project, progress: `${Math.min(counts.projects, 1)}/1`, done: counts.projects >= 1, href: "/workspace/projects?new=1", action: t.actionNewProject },
    { id: "compile", label: t.checklist.compile, progress: `${Math.min(counts.compiledProjects, 1)}/1`, done: counts.compiledProjects >= 1, href: "/workspace/projects", action: t.actionOpenProject },
    { id: "export", label: t.checklist.export, progress: `${Math.min(counts.exports, 1)}/1`, done: counts.exports >= 1, href: "/workspace/projects", action: t.actionOpenProject },
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
  const news = announcements[locale];
  const featured = news[0];
  const showBanner = featured !== undefined && cookieStore.get(bannerCookieName)?.value !== featured.id;
  const technologies = library ? recentTechnologies(projects?.projects ?? [], library.resources) : [];

  return (
    <WorkspaceShell active="Overview" user={user}>
      <section className="page overview-page">
        {showBanner && featured && <AnnouncementBanner announcement={featured} />}

        <header className="overview-hero">
          <div className="overview-hero-text">
            <LiveClock initial={new Date(now).toISOString()} />
            <h1>{returning ? t.welcomeBack : t.welcome}, {firstName}</h1>
            {returning && presence?.previousSignInAt ? (
              <ul aria-label={t.lastVisit} className="overview-meta">
                <li><SignIn aria-hidden size={18} />{t.lastSignIn}<time dateTime={presence.previousSignInAt}>{formats[locale].signIn.format(new Date(presence.previousSignInAt))}</time></li>
                {lastActivity && (
                  <li>
                    <ClockCounterClockwise aria-hidden size={18} />{t.latest}{" "}
                    {lastActivityHref ? <Link href={lastActivityHref}>{lastActivityText(lastActivity, projects?.projects ?? [], locale)}</Link> : lastActivityText(lastActivity, projects?.projects ?? [], locale)}
                    <span className="muted"> · {timeAgo(lastActivity.createdAt, now, locale)}</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="page-lead">{t.heroLead}</p>
            )}
          </div>
          <span aria-hidden="true" className="overview-hero-art"><span /><span /><span /></span>
        </header>

        {summary === null && <p className="note warning" role="status">{t.countsFailed}</p>}

        {firstRun && settings ? <FirstRunPanel settings={settings} /> : (
          <>
            {showCompactFirstRun && settings && <FirstRunPanel settings={settings} />}
            {doneCount < checklist.length && (
              <section aria-labelledby="checklist-title" className="checklist-panel">
                <h2 id="checklist-title">{t.setupTitle(doneCount, checklist.length)}</h2>
                <ol aria-label={t.setupSteps} className="checklist">
                  {checklist.map((item) => (
                    <li className={item.done ? "done" : ""} key={item.id}>
                      <span aria-hidden="true" className="mark">{item.done ? <Check aria-hidden size={14} weight="bold" /> : null}</span>
                      <div>
                        <strong>{item.label}</strong>
                        {item.done ? <small>{t.done}</small> : <Link href={item.href}>{item.action} · {item.progress}</Link>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {projects === null ? (
              <section className="overview-section"><h2 className="section-title">{t.yourProjects}</h2><p className="muted" role="status">{t.projectsFailed}</p></section>
            ) : (
              <Carousel
                action={projects.total > 0 ? <Link className="text-link locked" href="/workspace/projects">{t.allProjects} <ArrowRight aria-hidden size={18} /></Link> : undefined}
                perView={3}
                title={t.yourProjects}
                titleId="overview-projects"
              >
                {[
                  ...projects.projects.map((project) => <ProjectCard key={project.id} locale={locale} project={project} status={contextStatusFrom(statuses.get(project.id))} />),
                  <Link className="overview-card new-card" draggable={false} href="/workspace/projects?new=1" key="new-project">
                    <span className="mark large tone"><FolderSimplePlus aria-hidden size={30} /></span>
                    <strong className="card-title">{projects.total === 0 ? t.createFirstProject : t.newProject}</strong>
                    <p className="card-text">{t.newProjectText}</p>
                    <span className="button small"><Plus aria-hidden size={16} />{t.start}</span>
                  </Link>,
                ]}
              </Carousel>
            )}

            {library === null ? (
              <section className="overview-section"><h2 className="section-title">{t.recentTechnologies}</h2><p className="muted" role="status">{t.libraryFailed}</p></section>
            ) : technologies.length === 0 ? (
              <section className="overview-section">
                <h2 className="section-title">{t.recentTechnologies}</h2>
                <p className="muted">{t.noTechnologiesYet} <Link className="text-link" href="/workspace/library?add=1">{t.addFirstResource}</Link> {t.or} <Link className="text-link" href="/workspace/catalog">{t.browseCatalog}</Link>.</p>
              </section>
            ) : (
              <Carousel
                action={<Link className="text-link locked" href="/workspace/library">{t.library} <ArrowRight aria-hidden size={18} /></Link>}
                perView={4}
                title={t.recentTechnologies}
                titleId="overview-technologies"
              >
                {technologies.map((item) => (
                  <Link className="overview-card tech-card" draggable={false} href={`/workspace/library?q=${encodeURIComponent(item.name)}`} key={item.id}>
                    <span className="mark plain"><TechLogo name={item.name} size={30} slug={item.slug} /></span>
                    <span className="tech-card-text" title={item.name}>
                      <strong>{displayName(item.name)}</strong>
                      <small>{typeLabels[locale][item.type]}</small>
                    </span>
                    <span className={`tech-usage${item.projects > 0 ? " used" : ""}`}>{item.projects > 0 ? t.inProjects(item.projects) : t.inLibrary}</span>
                  </Link>
                ))}
              </Carousel>
            )}

            {suggestions === null ? (
              <section className="overview-section"><h2 className="section-title">{t.suggestions}</h2><p className="muted" role="status">{t.suggestionsFailed}</p></section>
            ) : suggestions.stacks.length + suggestions.technologies.length > 0 && (
              <>
                <Carousel
                  action={<Link className="text-link locked" href="/workspace/catalog"><Compass aria-hidden size={18} />{t.exploreCatalog}</Link>}
                  perView={3}
                  title={t.suggestions}
                  titleId="overview-suggestions"
                >
                  {suggestionCards(suggestions, locale)}
                </Carousel>
                <p className="muted small overview-footnote">{t.suggestionsFootnote}</p>
              </>
            )}
          </>
        )}

        <section aria-labelledby="overview-news" className="overview-section news" id="yenilikler">
          <div className="section-head">
            <h2 className="section-title" id="overview-news"><Megaphone aria-hidden size={22} />{t.news}</h2>
          </div>
          <ol aria-label={t.newsLabel} className="news-list">
            {news.map((item) => (
              <li className={`news-item ${item.kind}`} key={item.id}>
                <div className="news-meta">
                  <span className={`news-kind ${item.kind}`}>{announcementKindLabels[locale][item.kind]}</span>
                  {item.version && <span className="chip mono">{item.version}</span>}
                  <time dateTime={item.date}>{formats[locale].newsDate.format(new Date(`${item.date}T00:00:00Z`))}</time>
                </div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                {item.href && <Link className="text-link" href={item.href}>{t.takeALook} <ArrowRight aria-hidden size={16} /></Link>}
              </li>
            ))}
          </ol>
        </section>
      </section>
    </WorkspaceShell>
  );
}
