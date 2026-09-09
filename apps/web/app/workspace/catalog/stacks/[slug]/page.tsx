import { CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "../../../../../components/page-heading";
import { TechLogo } from "../../../../../components/tech-logo";
import { getCatalogStack } from "../../../../../lib/api";
import { layerLabels, levelLabels, teamSizeLabels, timeToMvpLabels } from "../../../../../lib/catalog-labels";
import { loadSession } from "../../../../../lib/server-session";
import { ServiceUnavailable } from "../../../unavailable";
import { WorkspaceShell } from "../../../workspace-shell";
import { StackActions } from "../../catalog-actions";

export const dynamic = "force-dynamic";

function ScoreBar({ label, value, production = false }: { label: string; value: number | null; production?: boolean }) {
  if (value === null) return null;
  return (
    <div className={`score-bar${production ? " production" : ""}`} title={`${label}: ${value} / 5 (editör değerlendirmesi)`}>
      <span>{label}</span>
      <span aria-hidden="true" className="segments">{[1, 2, 3, 4, 5].map((step) => <i className={step <= value ? "on" : ""} key={step} />)}</span>
      <span className="visually-hidden">{value} / 5</span>
    </div>
  );
}

export default async function CatalogStackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const stack = await getCatalogStack(cookieHeader, slug);
  if (!stack) notFound();
  const velocity = stack.velocity;

  return (
    <WorkspaceShell active="Catalog" user={user}>
      <section className="page">
        <Breadcrumb items={[{ label: "Katalog", href: "/workspace/catalog" }, { label: "Hazır stack’ler", href: "/workspace/catalog" }, { label: stack.name }]} />
        <h1 className="page-title" style={{ fontSize: 56 }}>{stack.name}</h1>
        <p className="page-lead" style={{ fontSize: 18 }}>{stack.summary}</p>
        <div className="chip-group" style={{ marginTop: 14 }}>
          <span className="chip">{teamSizeLabels[stack.teamSize]}</span>
          <span className="chip">{levelLabels[stack.learningCurve]}</span>
          <span className="chip">{timeToMvpLabels[stack.timeToMvp]}</span>
          <span className="chip">{stack.technologyCount} teknoloji</span>
        </div>
        <StackActions name={stack.name} slug={stack.slug} />
        <div className="split" style={{ marginTop: 28, borderTop: "1px solid var(--line)", paddingTop: 28 }}>
          <div>
            <h2 className="section-title" style={{ fontSize: 20 }}>Katmanlar</h2>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table aria-label="Katmanlar" className="table layer-table">
                <tbody>
                  {stack.layers.map((layer) => {
                    const first = layer.technologies[0];
                    return (
                      <tr key={layer.layer}>
                        <td><span className="mark large">{first ? <TechLogo name={first.name ?? first.slug} size={34} slug={first.slug} /> : null}</span></td>
                        <td style={{ fontSize: 18, fontWeight: 600, width: 160 }}>{layerLabels[layer.layer]}</td>
                        <td style={{ fontSize: 17 }}>
                          {layer.technologies.map((item, index) => (
                            <span key={item.slug}>{index > 0 ? " + " : ""}{item.known ? <Link className="text-link" href={`/workspace/catalog/${item.slug}`} style={{ color: "var(--ink)" }}>{item.name}</Link> : <span title="Henüz katalogda değil">{item.slug}</span>}</span>
                          ))}
                        </td>
                        <td className="muted">{layer.technologies.length} teknoloji</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <section className="prose-section" style={{ marginTop: 12 }}>
              <h2>Ne için uygun?</h2>
              <div className="two-col">
                <div><h4>Uygun olduğu işler</h4>{stack.bestFor.map((item) => <p key={item}>{item}</p>)}</div>
                <div><h4>Uygun olmadığı işler</h4>{stack.notFor.map((item) => <p key={item}>{item}</p>)}</div>
              </div>
              {stack.usedBy.length > 0 && <p className="muted small">Kullananlar: {stack.usedBy.join(", ")}</p>}
              <p style={{ color: "var(--ink-2)" }}>{stack.aiFriendliness}</p>
            </section>
          </div>
          <aside className="rail" style={{ borderLeft: "1px solid var(--line)", paddingLeft: 32 }}>
            <section aria-labelledby="fit-title">
              <h3 className="section-title small" id="fit-title" style={{ marginBottom: 16 }}>Uygun kullanım</h3>
              <ul className="check-rows">
                <li><CheckCircle aria-hidden size={22} />{teamSizeLabels[stack.teamSize]}</li>
                <li><CheckCircle aria-hidden size={22} />{timeToMvpLabels[stack.timeToMvp]}</li>
                <li><CheckCircle aria-hidden size={22} />{levelLabels[stack.learningCurve]}</li>
              </ul>
            </section>
            <hr className="divider" style={{ margin: "4px 0" }} />
            <section aria-labelledby="editor-title">
              <h3 className="section-title small" id="editor-title" style={{ marginBottom: 16 }}>Editör değerlendirmesi</h3>
              <div className="score-bars">
                <ScoreBar label="Prototip hızı" value={stack.prototypeSpeed} />
                <ScoreBar label="Üretime hazırlık" production value={stack.productionReadiness} />
              </div>
              {velocity && velocity.productionGaps[0] && (
                <p className="note warning" role="note" style={{ marginTop: 20 }}><Warning aria-hidden size={20} />Üretim öncesi: {velocity.productionGaps[0]}</p>
              )}
              {velocity && <p className="muted small" style={{ marginTop: 14 }}>{velocity.verdict}</p>}
            </section>
            <hr className="divider" style={{ margin: "4px 0" }} />
            <section>
              <h3 className="section-title small" style={{ marginBottom: 10 }}>Stack profili oluştur ne yapar?</h3>
              <p className="muted small">Bu setteki bilinen her teknolojiyi Kütüphanene ekler ve her karar alanı için “Tercih edilen” kararıyla bir stack profili oluşturur. Profili istediğin projeye bağlayabilirsin; hiçbir şey kilitlenmez.</p>
            </section>
          </aside>
        </div>
      </section>
    </WorkspaceShell>
  );
}
