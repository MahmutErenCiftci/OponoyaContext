import type { Metadata } from "next";
import type { AdminOverview } from "@devcontext/contracts";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { PageHead } from "../../components/page-heading";
import { getAdminFeedback, getAdminOverview } from "../../lib/api";
import { formatDateTime, formatTime } from "../../lib/resource-labels";
import { loadSession } from "../../lib/server-session";
import { ServiceUnavailable } from "../workspace/unavailable";
import { WorkspaceShell } from "../workspace/workspace-shell";
import { FeedbackInbox } from "./feedback-inbox";

export const metadata: Metadata = { title: "Yönetim paneli", robots: { index: false, follow: false } };

const number = new Intl.NumberFormat("tr-TR");
const percent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const dayLabel = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDayLabel = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

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

function StatTile({ label, value, hint, hero = false }: { label: string; value: number; hint?: string; hero?: boolean }) {
  return (
    <div className={`admin-stat${hero ? " hero" : ""}`}>
      <dt>{label}</dt>
      <dd><strong>{number.format(value)}</strong>{hint && <small>{hint}</small>}</dd>
    </div>
  );
}

function SignupChart({ days }: { days: AdminOverview["signupsByDay"] }) {
  const peak = Math.max(0, ...days.map((day) => day.count));
  const top = axisMax(peak);
  const ticks = [0, top / 2, top];
  // The newest day among the highest ones carries the only direct label.
  const peakIndex = peak > 0 ? days.map((day) => day.count).lastIndexOf(peak) : -1;
  const total = days.reduce((sum, day) => sum + day.count, 0);
  return (
    <figure aria-labelledby="admin-signups-title" className="admin-chart">
      <figcaption>
        <h2 className="section-title small" id="admin-signups-title">Günlük kayıtlar</h2>
        <p className="muted small">Son 30 gün · toplam {number.format(total)} kayıt · Türkiye saatine göre</p>
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
              <span className="admin-tip">{dayLabel.format(utcDay(day.date))}<strong>{number.format(day.count)} kayıt</strong></span>
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden="true" className="admin-chart-axis">
        {/* Weekly ticks plus today; a weekly tick too close to today is dropped so the two never overlap. */}
        {days.map((day, index) => <span key={day.date}>{index === days.length - 1 || (index % 7 === 0 && index < days.length - 3) ? dayLabel.format(utcDay(day.date)) : ""}</span>)}
      </div>
      <table className="visually-hidden">
        <caption>Son 30 günün günlük kayıt sayıları</caption>
        <thead><tr><th scope="col">Gün</th><th scope="col">Kayıt</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.date}><td>{longDayLabel.format(utcDay(day.date))}</td><td>{day.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

function Funnel({ funnel }: { funnel: AdminOverview["funnel"] }) {
  const steps: Array<[string, number]> = [
    ["Kayıt oldu", funnel.signedUp],
    ["Kendi kaynağını ekledi", funnel.addedResource],
    ["Kendi projesini oluşturdu", funnel.createdProject],
    ["Talimat oluşturdu", funnel.compiledContext],
    ["Bir agent’a aktardı", funnel.exportedContext],
    ["İkinci projeyi açtı", funnel.secondProject],
  ];
  const base = funnel.signedUp;
  return (
    <section aria-labelledby="admin-funnel-title" className="card admin-funnel-card">
      <h2 className="section-title small" id="admin-funnel-title">Aktivasyon hunisi</h2>
      <p className="muted small">Her adımı en az bir kez yapan kullanıcı sayısı; yüzde, tüm kayıtlara göre. Örnek veriyle gelen kayıtlar sayılmaz.</p>
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

function NotAllowed({ userId }: { userId: string }) {
  return (
    <section className="page">
      <div className="card admin-locked">
        <LockSimple aria-hidden size={40} />
        <h1 className="section-title">Bu sayfa yalnızca yöneticilere açık</h1>
        <p className="muted">Yönetici erişimi sunucu ayarlarından verilir. Bu hesabı yetkilendirmek için aşağıdaki hesap kimliğini API’nin <code>ADMIN_USER_IDS</code> ayarına ekleyip API’yi yeniden başlat.</p>
        <p className="admin-user-id"><span className="muted small">Hesap kimliğin</span><code>{userId}</code></p>
      </div>
    </section>
  );
}

export default async function AdminPage() {
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [result, inbox] = await Promise.all([
    getAdminOverview(cookieHeader),
    session.admin ? getAdminFeedback(cookieHeader, "new") : Promise.resolve(null),
  ]);

  if (result.status === "forbidden") {
    return <WorkspaceShell active={null} user={user}><NotAllowed userId={user.id} /></WorkspaceShell>;
  }

  return (
    <WorkspaceShell active="Admin" user={user}>
      <section className="page admin-page">
        <PageHead
          lead={result.status === "ok"
            ? `Tüm hesaplar genelinde kayıt ve kullanım sayıları. Son güncelleme ${formatTime(result.overview.generatedAt)}; sayfa her açılışta yeniden hesaplanır.`
            : "Tüm hesaplar genelinde kayıt ve kullanım sayıları."}
          title="Yönetim paneli"
        />
        {result.status === "unavailable" ? (
          <p className="note warning" role="status">Yönetim verileri şu an yüklenemedi. Sayfayı yenileyip tekrar dene.</p>
        ) : (
          <>
            <dl aria-label="Kullanıcılar" className="admin-stats">
              <StatTile hero label="Toplam kullanıcı" value={result.overview.users.total} />
              <StatTile label="Son 24 saat" value={result.overview.users.last24h} hint="yeni kayıt" />
              <StatTile label="Son 7 gün" value={result.overview.users.last7d} hint="yeni kayıt" />
              <StatTile label="Son 30 gün" value={result.overview.users.last30d} hint="yeni kayıt" />
              <StatTile label="Aktif (7 gün)" value={result.overview.users.active7d} hint="giriş yapan ya da çalışan" />
              <StatTile label="Aktif (30 gün)" value={result.overview.users.active30d} hint="giriş yapan ya da çalışan" />
              <StatTile label="Silinen hesap" value={result.overview.users.deleted} hint="tüm zamanlar" />
            </dl>

            <div className="admin-grid">
              <section className="card"><SignupChart days={result.overview.signupsByDay} /></section>
              <Funnel funnel={result.overview.funnel} />
            </div>

            <FeedbackInbox counts={result.overview.feedback} initial={inbox} />

            <section aria-labelledby="admin-totals-title" className="overview-section">
              <h2 className="section-title small" id="admin-totals-title">Saklanan içerik</h2>
              <dl className="stored-grid">
                {([
                  ["Proje", result.overview.totals.projects],
                  ["Kütüphane kaynağı", result.overview.totals.resources],
                  ["Profil", result.overview.totals.profiles],
                  ["Tarif", result.overview.totals.recipes],
                  ["Talimat sürümü", result.overview.totals.contextVersions],
                  ["Dışa aktarma", result.overview.totals.exports],
                  ["Örnek veri yükleyen", result.overview.totals.sampleInstalls],
                  ["Aktif Pro abonelik", result.overview.totals.proSubscriptions],
                ] as const).map(([label, value]) => <div key={label}><dt><small>{label}</small></dt><dd><strong>{number.format(value)}</strong></dd></div>)}
              </dl>
              <p className="muted small admin-footnote">Toplamlar örnek verileri de içerir.</p>
            </section>

            <section aria-labelledby="admin-recent-title" className="overview-section">
              <h2 className="section-title small" id="admin-recent-title">Son kayıt olanlar</h2>
              {result.overview.recentUsers.length === 0 ? <p className="muted">Henüz kayıtlı kullanıcı yok.</p> : (
                <div className="table-wrap">
                  <table className="table bordered">
                    <thead><tr><th scope="col">Ad</th><th scope="col">E-posta</th><th scope="col">Kayıt</th><th scope="col">Son görülme</th><th scope="col">Proje</th></tr></thead>
                    <tbody>
                      {result.overview.recentUsers.map((row) => (
                        <tr key={row.id}>
                          <td data-label="Ad"><strong>{row.name}</strong></td>
                          <td data-label="E-posta"><a className="text-link" href={`mailto:${row.email}`}>{row.email}</a></td>
                          <td data-label="Kayıt">{formatDateTime(row.createdAt)}</td>
                          <td data-label="Son görülme">{row.lastSeenAt ? formatDateTime(row.lastSeenAt) : <span className="muted">Oturum yok</span>}</td>
                          <td data-label="Proje">{number.format(row.projects)}</td>
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
