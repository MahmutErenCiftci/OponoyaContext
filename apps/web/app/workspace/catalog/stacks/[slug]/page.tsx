import type { Metadata } from "next";
import { CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "../../../../../components/page-heading";
import { TechLogo } from "../../../../../components/tech-logo";
import { getCatalogStack } from "../../../../../lib/api";
import { layerLabels, levelLabels, teamSizeLabels, timeToMvpLabels } from "../../../../../lib/catalog-labels";
import { defineCopy } from "../../../../../lib/i18n";
import { getLocale } from "../../../../../lib/locale-server";
import { loadSession } from "../../../../../lib/server-session";
import { ServiceUnavailable } from "../../../unavailable";
import { WorkspaceShell } from "../../../workspace-shell";
import { StackActions } from "../../catalog-actions";

const copy = defineCopy({
  tr: {
    stack: "Hazır stack",
    scoreTitle: (label: string, value: number) => `${label}: ${value} / 5 (editör değerlendirmesi)`,
    catalog: "Katalog",
    stacks: "Hazır stack’ler",
    /** English only: the catalog content itself is written in Turkish. */
    contentLanguageNote: null as string | null,
    technologies: (count: number) => `${count} teknoloji`,
    layers: "Katmanlar",
    notInCatalog: "Henüz katalogda değil",
    fitTitle: "Ne için uygun?",
    bestFor: "Uygun olduğu işler",
    notFor: "Uygun olmadığı işler",
    usedBy: "Kullananlar: ",
    fit: "Uygun kullanım",
    editorAssessment: "Editör değerlendirmesi",
    prototypeSpeed: "Prototip hızı",
    productionReadiness: "Üretime hazırlık",
    beforeProduction: "Üretim öncesi: ",
    profileQuestion: "Stack profili oluştur ne yapar?",
    profileAnswer: "Bu setteki bilinen her teknolojiyi Kütüphanene ekler ve her karar alanı için “Tercih edilen” kararıyla bir stack profili oluşturur. Profili istediğin projeye bağlayabilirsin; hiçbir şey kilitlenmez.",
  },
  en: {
    stack: "Ready-made stack",
    scoreTitle: (label: string, value: number) => `${label}: ${value} / 5 (editor assessment)`,
    catalog: "Catalog",
    stacks: "Ready-made stacks",
    contentLanguageNote: "Technology descriptions are currently available in Turkish only.",
    technologies: (count: number) => `${count} ${count === 1 ? "technology" : "technologies"}`,
    layers: "Layers",
    notInCatalog: "Not in the catalog yet",
    fitTitle: "What is it good for?",
    bestFor: "Good for",
    notFor: "Not a good fit for",
    usedBy: "Used by: ",
    fit: "Best fit",
    editorAssessment: "Editor assessment",
    prototypeSpeed: "Prototype speed",
    productionReadiness: "Production readiness",
    beforeProduction: "Before production: ",
    profileQuestion: "What does “Create stack profile” do?",
    profileAnswer: "It adds every known technology in this set to your Library and creates a stack profile with a “Preferred” decision for each decision slot. You can attach the profile to any project; nothing is locked.",
  },
});

/** The entity name in the tab title; the lookup is shared with the page through the per-request cache. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [session, locale] = await Promise.all([loadSession(), getLocale()]);
  const stack = session.status === "authenticated" ? await getCatalogStack(session.cookieHeader, slug) : null;
  return { title: stack ? stack.name : copy[locale].stack };
}

function ScoreBar({ label, value, production = false, title }: { label: string; value: number | null; production?: boolean; title: (label: string, value: number) => string }) {
  if (value === null) return null;
  return (
    <div className={`score-bar${production ? " production" : ""}`} title={title(label, value)}>
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
  const [stack, locale] = await Promise.all([getCatalogStack(cookieHeader, slug), getLocale()]);
  if (!stack) notFound();
  const t = copy[locale];
  const velocity = stack.velocity;

  return (
    <WorkspaceShell active="Catalog" user={user}>
      <section className="page">
        <Breadcrumb items={[{ label: t.catalog, href: "/workspace/catalog" }, { label: t.stacks, href: "/workspace/catalog" }, { label: stack.name }]} />
        <h1 className="page-title">{stack.name}</h1>
        <p className="page-lead" style={{ fontSize: 18 }}>{stack.summary}</p>
        {t.contentLanguageNote && <p className="muted small" role="note" style={{ marginTop: 8 }}>{t.contentLanguageNote}</p>}
        <div className="chip-group" style={{ marginTop: 14 }}>
          <span className="chip">{teamSizeLabels[locale][stack.teamSize]}</span>
          <span className="chip">{levelLabels[locale][stack.learningCurve]}</span>
          <span className="chip">{timeToMvpLabels[locale][stack.timeToMvp]}</span>
          <span className="chip">{t.technologies(stack.technologyCount)}</span>
        </div>
        <StackActions name={stack.name} slug={stack.slug} />
        <div className="split" style={{ marginTop: 28, borderTop: "1px solid var(--line)", paddingTop: 28 }}>
          <div>
            <h2 className="section-title" style={{ fontSize: 20 }}>{t.layers}</h2>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table aria-label={t.layers} className="table layer-table">
                <tbody>
                  {stack.layers.map((layer) => {
                    const first = layer.technologies[0];
                    return (
                      <tr key={layer.layer}>
                        <td><span className="mark large">{first ? <TechLogo name={first.name ?? first.slug} size={34} slug={first.slug} /> : null}</span></td>
                        <td style={{ fontSize: 18, fontWeight: 600, width: 160 }}>{layerLabels[locale][layer.layer]}</td>
                        <td style={{ fontSize: 17 }}>
                          {layer.technologies.map((item, index) => (
                            <span key={item.slug}>{index > 0 ? " + " : ""}{item.known ? <Link className="text-link" href={`/workspace/catalog/${item.slug}`} style={{ color: "var(--ink)" }}>{item.name}</Link> : <span title={t.notInCatalog}>{item.slug}</span>}</span>
                          ))}
                        </td>
                        <td className="muted">{t.technologies(layer.technologies.length)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <section className="prose-section" style={{ marginTop: 12 }}>
              <h2>{t.fitTitle}</h2>
              <div className="two-col">
                <div><h4>{t.bestFor}</h4>{stack.bestFor.map((item) => <p key={item}>{item}</p>)}</div>
                <div><h4>{t.notFor}</h4>{stack.notFor.map((item) => <p key={item}>{item}</p>)}</div>
              </div>
              {stack.usedBy.length > 0 && <p className="muted small">{t.usedBy}{stack.usedBy.join(", ")}</p>}
              <p style={{ color: "var(--ink-2)" }}>{stack.aiFriendliness}</p>
            </section>
          </div>
          <aside className="rail bordered">
            <section aria-labelledby="fit-title">
              <h3 className="section-title small" id="fit-title" style={{ marginBottom: 16 }}>{t.fit}</h3>
              <ul className="check-rows">
                <li><CheckCircle aria-hidden size={22} />{teamSizeLabels[locale][stack.teamSize]}</li>
                <li><CheckCircle aria-hidden size={22} />{timeToMvpLabels[locale][stack.timeToMvp]}</li>
                <li><CheckCircle aria-hidden size={22} />{levelLabels[locale][stack.learningCurve]}</li>
              </ul>
            </section>
            <hr className="divider" style={{ margin: "4px 0" }} />
            <section aria-labelledby="editor-title">
              <h3 className="section-title small" id="editor-title" style={{ marginBottom: 16 }}>{t.editorAssessment}</h3>
              <div className="score-bars">
                <ScoreBar label={t.prototypeSpeed} title={t.scoreTitle} value={stack.prototypeSpeed} />
                <ScoreBar label={t.productionReadiness} production title={t.scoreTitle} value={stack.productionReadiness} />
              </div>
              {velocity && velocity.productionGaps[0] && (
                <p className="note warning" role="note" style={{ marginTop: 20 }}><Warning aria-hidden size={20} />{t.beforeProduction}{velocity.productionGaps[0]}</p>
              )}
              {velocity && <p className="muted small" style={{ marginTop: 14 }}>{velocity.verdict}</p>}
            </section>
            <hr className="divider" style={{ margin: "4px 0" }} />
            <section>
              <h3 className="section-title small" style={{ marginBottom: 10 }}>{t.profileQuestion}</h3>
              <p className="muted small">{t.profileAnswer}</p>
            </section>
          </aside>
        </div>
      </section>
    </WorkspaceShell>
  );
}
