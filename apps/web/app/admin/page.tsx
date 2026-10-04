import type { Metadata } from "next";
import type { AdminOverview } from "@devcontext/contracts";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { PageHead } from "../../components/page-heading";
import { getAdminFeedback, getAdminOverview } from "../../lib/api";
import { defineCopy, intlLocales, type Locale } from "../../lib/i18n";
import { getLocale } from "../../lib/locale-server";
import { formatDateTime, formatTime } from "../../lib/resource-labels";
import { loadSession } from "../../lib/server-session";
import { ServiceUnavailable } from "../workspace/unavailable";
import { WorkspaceShell } from "../workspace/workspace-shell";
import { FeedbackInbox } from "./feedback-inbox";

const copy = defineCopy({
  tr: {
    title: "Yönetim paneli",
    signupsTitle: "Günlük kayıtlar",
    signupsLead: (total: string) => `Son 30 gün · toplam ${total} kayıt · Türkiye saatine göre`,
    signupsTip: (count: string) => `${count} kayıt`,
    signupsCaption: "Son 30 günün günlük kayıt sayıları",
    day: "Gün",
    signups: "Kayıt",
    funnel: {
      signedUp: "Kayıt oldu",
      addedResource: "Kendi kaynağını ekledi",
      createdProject: "Kendi projesini oluşturdu",
      compiledContext: "Talimat oluşturdu",
      exportedContext: "Bir agent’a aktardı",
      secondProject: "İkinci projeyi açtı",
    } satisfies Record<keyof AdminOverview["funnel"], string>,
    funnelTitle: "Aktivasyon hunisi",
    funnelLead: "Her adımı en az bir kez yapan kullanıcı sayısı; yüzde, tüm kayıtlara göre. Örnek veriyle gelen kayıtlar sayılmaz.",
    lockedTitle: "Bu sayfa yalnızca yöneticilere açık",
    lockedBefore: "Yönetici erişimi sunucu ayarlarından verilir. Bu hesabı yetkilendirmek için aşağıdaki hesap kimliğini API’nin ",
    lockedAfter: " ayarına ekleyip API’yi yeniden başlat.",
    yourUserId: "Hesap kimliğin",
    leadWithTime: (time: string) => `Tüm hesaplar genelinde kayıt ve kullanım sayıları. Son güncelleme ${time}; sayfa her açılışta yeniden hesaplanır.`,
    lead: "Tüm hesaplar genelinde kayıt ve kullanım sayıları.",
    unavailable: "Yönetim verileri şu an yüklenemedi. Sayfayı yenileyip tekrar dene.",
    usersLabel: "Kullanıcılar",
    totalUsers: "Toplam kullanıcı",
    last24h: "Son 24 saat",
    last7d: "Son 7 gün",
    last30d: "Son 30 gün",
    newSignups: "yeni kayıt",
    active7d: "Aktif (7 gün)",
    active30d: "Aktif (30 gün)",
    activeHint: "giriş yapan ya da çalışan",
    deleted: "Silinen hesap",
    allTime: "tüm zamanlar",
    storedTitle: "Saklanan içerik",
    totals: {
      projects: "Proje",
      resources: "Kütüphane kaynağı",
      profiles: "Profil",
      recipes: "Tarif",
      contextVersions: "Talimat sürümü",
      exports: "Dışa aktarma",
      sampleInstalls: "Örnek veri yükleyen",
      proSubscriptions: "Aktif Pro abonelik",
    },
    totalsNote: "Toplamlar örnek verileri de içerir.",
    recentTitle: "Son kayıt olanlar",
    noUsers: "Henüz kayıtlı kullanıcı yok.",
    name: "Ad",
    email: "E-posta",
    signedUp: "Kayıt",
    lastSeen: "Son görülme",
    projects: "Proje",
    noSession: "Oturum yok",
  },
  en: {
    title: "Admin panel",
    signupsTitle: "Daily sign-ups",
    signupsLead: (total: string) => `Last 30 days · ${total} sign-ups in total · Türkiye time`,
    signupsTip: (count: string) => `${count} ${count === "1" ? "sign-up" : "sign-ups"}`,
    signupsCaption: "Daily sign-up counts for the last 30 days",
    day: "Day",
    signups: "Sign-ups",
    funnel: {
      signedUp: "Signed up",
      addedResource: "Added their own resource",
      createdProject: "Created their own project",
      compiledContext: "Generated instructions",
      exportedContext: "Handed them to an agent",
      secondProject: "Opened a second project",
    },
    funnelTitle: "Activation funnel",
    funnelLead: "Users who did each step at least once; the percentage is relative to all sign-ups. Records created by sample data are not counted.",
    lockedTitle: "This page is open to administrators only",
    lockedBefore: "Admin access is granted in the server settings. To authorize this account, add the account id below to the API's ",
    lockedAfter: " setting and restart the API.",
    yourUserId: "Your account id",
    leadWithTime: (time: string) => `Sign-up and usage counts across all accounts. Last updated ${time}; the page is recalculated every time it opens.`,
    lead: "Sign-up and usage counts across all accounts.",
    unavailable: "Admin data could not be loaded right now. Refresh the page and try again.",
    usersLabel: "Users",
    totalUsers: "Total users",
    last24h: "Last 24 hours",
    last7d: "Last 7 days",
    last30d: "Last 30 days",
    newSignups: "new sign-ups",
    active7d: "Active (7 days)",
    active30d: "Active (30 days)",
    activeHint: "signed in or working",
    deleted: "Deleted accounts",
    allTime: "all time",
    storedTitle: "Stored content",
    totals: {
      projects: "Projects",
      resources: "Library resources",
      profiles: "Profiles",
      recipes: "Recipes",
      contextVersions: "Instruction versions",
      exports: "Exports",
      sampleInstalls: "Sample data installs",
      proSubscriptions: "Active Pro subscriptions",
    },
    totalsNote: "Totals include sample data.",
    recentTitle: "Recent sign-ups",
    noUsers: "No registered users yet.",
    name: "Name",
    email: "E-mail",
    signedUp: "Signed up",
    lastSeen: "Last seen",
    projects: "Projects",
    noSession: "No session",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].title, robots: { index: false, follow: false } };
}

function adminFormats(locale: Locale) {
  const tag = intlLocales[locale];
  return {
    number: new Intl.NumberFormat(tag),
    percent: new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 }),
    dayLabel: new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: "UTC" }),
    longDayLabel: new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
  };
}

const formats: Record<Locale, ReturnType<typeof adminFormats>> = { tr: adminFormats("tr"), en: adminFormats("en") };

/** Days are calendar dates in the API's zone; read them at UTC midnight so formatting never shifts the day. */
function utcDay(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

/** Smallest clean axis top at or above the peak whose half is a whole number (2, 4, 6, 8, 10, 20, 40, …). */
function axisMax(peak: number) {
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const step of magnitude === 1 ? [2, 4, 6, 8] : [1, 2, 4, 6, 8]) {
      if (step * magnitude >= peak) return step * magnitude;
    }
  }
}

function StatTile({ label, value, hint, hero = false, locale }: { label: string; value: number; hint?: string; hero?: boolean; locale: Locale }) {
  return (
    <div className={`admin-stat${hero ? " hero" : ""}`}>
      <dt>{label}</dt>
      <dd><strong>{formats[locale].number.format(value)}</strong>{hint && <small>{hint}</small>}</dd>
    </div>
  );
}

function SignupChart({ days, locale }: { days: AdminOverview["signupsByDay"]; locale: Locale }) {
  const t = copy[locale];
  const { number, dayLabel, longDayLabel } = formats[locale];
  const peak = Math.max(0, ...days.map((day) => day.count));
  const top = axisMax(peak);
  const ticks = [0, top / 2, top];
  // The newest day among the highest ones carries the only direct label.
  const peakIndex = peak > 0 ? days.map((day) => day.count).lastIndexOf(peak) : -1;
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <figure aria-labelledby="admin-signups-title" className="admin-chart">
      <figcaption>
        <h2 className="section-title small" id="admin-signups-title">{t.signupsTitle}</h2>
        <p className="muted small">{t.signupsLead(number.format(total))}</p>
      </figcaption>
      <div aria-hidden="true" className="admin-chart-plot">
        <div className="admin-chart-grid">
          {ticks.map((tick) => <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}><em>{number.format(tick)}</em></span>)}
        </div>
        <ol className="admin-chart-bars">
          {days.map((day, index) => (
            <li key={day.date}>
              {day.count > 0 && <span className="admin-bar" style={{ height: `${(day.count / top) * 100}%` }} />}
              {index === peakIndex && <b className="admin-bar-label" style={{ bottom: `${(day.count / top) * 100}%` }}>{number.format(day.count)}</b>}
              <span className="admin-tip">{dayLabel.format(utcDay(day.date))}<strong>{t.signupsTip(number.format(day.count))}</strong></span>
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden="true" className="admin-chart-axis">
        {/* Weekly ticks plus today; a weekly tick too close to today is dropped so the two never overlap. */}
        {days.map((day, index) => <span key={day.date}>{index === days.length - 1 || (index % 7 === 0 && index < days.length - 3) ? dayLabel.format(utcDay(day.date)) : ""}</span>)}
      </div>
      <table className="visually-hidden">
        <caption>{t.signupsCaption}</caption>
        <thead><tr><th scope="col">{t.day}</th><th scope="col">{t.signups}</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.date}><td>{longDayLabel.format(utcDay(day.date))}</td><td>{day.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function Funnel({ funnel, locale }: { funnel: AdminOverview["funnel"]; locale: Locale }) {
  const t = copy[locale];
  const { number, percent } = formats[locale];
  const steps: Array<[string, number]> = [
    [t.funnel.signedUp, funnel.signedUp],
    [t.funnel.addedResource, funnel.addedResource],
    [t.funnel.createdProject, funnel.createdProject],
    [t.funnel.compiledContext, funnel.compiledContext],
    [t.funnel.exportedContext, funnel.exportedContext],
    [t.funnel.secondProject, funnel.secondProject],
  ];
  const base = funnel.signedUp;
  return (
    <section aria-labelledby="admin-funnel-title" className="card admin-funnel-card">
      <h2 className="section-title small" id="admin-funnel-title">{t.funnelTitle}</h2>
      <p className="muted small">{t.funnelLead}</p>
      <ol className="admin-funnel">
        {steps.map(([label, value]) => {
          const share = base > 0 ? value / base : 0;
          return (
            <li key={label}>
              <span className="admin-funnel-label">{label}</span>
              <span aria-hidden="true" className="admin-funnel-track">{value > 0 && <span style={{ width: `${Math.max(share * 100, 1)}%` }} />}</span>
              <span className="admin-funnel-value"><strong>{number.format(value)}</strong><small>{percent.format(share)}</small></span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NotAllowed({ userId, locale }: { userId: string; locale: Locale }) {
  const t = copy[locale];
  return (
    <section className="page">
      <div className="card admin-locked">
        <LockSimple aria-hidden size={40} />
        <h1 className="section-title">{t.lockedTitle}</h1>
        <p className="muted">{t.lockedBefore}<code>ADMIN_USER_IDS</code>{t.lockedAfter}</p>
        <p className="admin-user-id"><span className="muted small">{t.yourUserId}</span><code>{userId}</code></p>
      </div>
    </section>
  );
}

export default async function AdminPage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [result, inbox, locale] = await Promise.all([
    getAdminOverview(cookieHeader),
    session.admin ? getAdminFeedback(cookieHeader, "new") : Promise.resolve(null),
    getLocale(),
  ]);
  const t = copy[locale];
  const { number } = formats[locale];

  if (result.status === "forbidden") {
    return <WorkspaceShell active={null} user={user}><NotAllowed locale={locale} userId={user.id} /></WorkspaceShell>;
  }

  return (
    <WorkspaceShell active="Admin" user={user}>
      <section className="page admin-page">
        <PageHead
          lead={result.status === "ok" ? t.leadWithTime(formatTime(result.overview.generatedAt, locale)) : t.lead}
          title={t.title}
        />
        {result.status === "unavailable" ? (
          <p className="note warning" role="status">{t.unavailable}</p>
        ) : (
          <>
            <dl aria-label={t.usersLabel} className="admin-stats">
              <StatTile hero label={t.totalUsers} locale={locale} value={result.overview.users.total} />
              <StatTile hint={t.newSignups} label={t.last24h} locale={locale} value={result.overview.users.last24h} />
              <StatTile hint={t.newSignups} label={t.last7d} locale={locale} value={result.overview.users.last7d} />
              <StatTile hint={t.newSignups} label={t.last30d} locale={locale} value={result.overview.users.last30d} />
              <StatTile hint={t.activeHint} label={t.active7d} locale={locale} value={result.overview.users.active7d} />
              <StatTile hint={t.activeHint} label={t.active30d} locale={locale} value={result.overview.users.active30d} />
              <StatTile hint={t.allTime} label={t.deleted} locale={locale} value={result.overview.users.deleted} />
            </dl>

            <div className="admin-grid">
              <section className="card"><SignupChart days={result.overview.signupsByDay} locale={locale} /></section>
              <Funnel funnel={result.overview.funnel} locale={locale} />
            </div>

            <FeedbackInbox counts={result.overview.feedback} initial={inbox} />

            <section aria-labelledby="admin-totals-title" className="overview-section">
              <h2 className="section-title small" id="admin-totals-title">{t.storedTitle}</h2>
              <dl className="stored-grid">
                {([
                  [t.totals.projects, result.overview.totals.projects],
                  [t.totals.resources, result.overview.totals.resources],
                  [t.totals.profiles, result.overview.totals.profiles],
                  [t.totals.recipes, result.overview.totals.recipes],
                  [t.totals.contextVersions, result.overview.totals.contextVersions],
                  [t.totals.exports, result.overview.totals.exports],
                  [t.totals.sampleInstalls, result.overview.totals.sampleInstalls],
                  [t.totals.proSubscriptions, result.overview.totals.proSubscriptions],
                ] as const).map(([label, value]) => <div key={label}><dt><small>{label}</small></dt><dd><strong>{number.format(value)}</strong></dd></div>)}
              </dl>
              <p className="muted small admin-footnote">{t.totalsNote}</p>
            </section>

            <section aria-labelledby="admin-recent-title" className="overview-section">
              <h2 className="section-title small" id="admin-recent-title">{t.recentTitle}</h2>
              {result.overview.recentUsers.length === 0 ? <p className="muted">{t.noUsers}</p> : (
                <div className="table-wrap">
                  <table className="table bordered">
                    <thead><tr><th scope="col">{t.name}</th><th scope="col">{t.email}</th><th scope="col">{t.signedUp}</th><th scope="col">{t.lastSeen}</th><th scope="col">{t.projects}</th></tr></thead>
                    <tbody>
                      {result.overview.recentUsers.map((row) => (
                        <tr key={row.id}>
                          <td data-label={t.name}><strong>{row.name}</strong></td>
                          <td data-label={t.email}><a className="text-link" href={`mailto:${row.email}`}>{row.email}</a></td>
                          <td data-label={t.signedUp}>{formatDateTime(row.createdAt, locale)}</td>
                          <td data-label={t.lastSeen}>{row.lastSeenAt ? formatDateTime(row.lastSeenAt, locale) : <span className="muted">{t.noSession}</span>}</td>
                          <td data-label={t.projects}>{number.format(row.projects)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </WorkspaceShell>
  );
}
