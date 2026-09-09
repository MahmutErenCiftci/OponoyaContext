import type { CatalogReference } from "@devcontext/contracts";
import { ArrowSquareOut, BookOpen, CheckCircle, GithubLogo, MinusCircle, Scales, Terminal } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyButton } from "../../../../components/copy-button";
import { Breadcrumb } from "../../../../components/page-heading";
import { ScoreMeter } from "../../../../components/score-meter";
import { TechLogo } from "../../../../components/tech-logo";
import { getCatalogLibraryLinks, getCatalogTechnology } from "../../../../lib/api";
import { authorizedUseTag, domainLabels, levelLabels, maturityLabels, popularityLabels, pricingLabels } from "../../../../lib/catalog-labels";
import { typeLabels } from "../../../../lib/resource-labels";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { TechnologyActions } from "../catalog-actions";

export const dynamic = "force-dynamic";

function hostOf(url: string) {
  try { return new URL(url).host.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, ""); } catch { return url; }
}

function Related({ items }: { items: CatalogReference[] }) {
  if (items.length === 0) return <p className="muted">Listelenmiş değil.</p>;
  return (
    <div className="related-grid">
      {items.map((item) => item.known
        ? <Link href={`/workspace/catalog/${item.slug}`} key={item.slug}><span className="mark"><TechLogo name={item.name ?? item.slug} size={24} slug={item.slug} /></span><span><strong>{item.name}</strong><small>Katalogda</small></span></Link>
        : <span className="chip" key={item.slug} title="Henüz katalogda değil">{item.slug}</span>)}
    </div>
  );
}

export default async function CatalogTechnologyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [technology, links] = await Promise.all([getCatalogTechnology(cookieHeader, slug), getCatalogLibraryLinks(cookieHeader)]);
  if (!technology) notFound();
  const readiness = technology.readiness;
  const velocity = technology.velocity;

  return (
    <WorkspaceShell active="Catalog" user={user}>
      <section className="page">
        <Breadcrumb items={[{ label: "Katalog", href: "/workspace/catalog" }, { label: technology.name }]} />
        <div className="tech-hero">
          <span className="mark xl"><TechLogo name={technology.name} size={44} slug={technology.slug} /></span>
          <div>
            <h1 className="page-title">{technology.name}</h1>
            <p className="sub">{typeLabels[technology.type]} · {domainLabels[technology.domain]} · {technology.category}</p>
          </div>
          <TechnologyActions name={technology.name} resourceId={links[technology.slug] ?? null} slug={technology.slug} />
        </div>
        <p className="page-lead" style={{ marginTop: 18 }}>{technology.summary}</p>
        <div className="chip-group" style={{ marginTop: 14 }}>
          <span className="chip">{popularityLabels[technology.popularity]}</span>
          <span className="chip">{maturityLabels[technology.maturity]}</span>
          <span className="chip">{levelLabels[technology.learningCurve]}</span>
          <span className="chip">{pricingLabels[technology.pricing]}</span>
          {technology.tags.includes(authorizedUseTag) && <span className="chip" style={{ color: "var(--warning)" }}>Yalnızca yetkili kullanım</span>}
        </div>

        <div className="split" style={{ marginTop: 20 }}>
          <div>
            <section className="prose-section">
              <h2>Ne zaman uygun?</h2>
              <ul className="bullets">
                <li>{technology.whatFor}</li>
                <li>{technology.whereUsed}</li>
                <li>{technology.commonUse}</li>
              </ul>
            </section>
            <section className="prose-section">
              <h2>Güçlü yönler ve sınırlar</h2>
              <div className="two-col">
                <div>
                  <h4><CheckCircle aria-hidden size={22} style={{ color: "var(--success)" }} />Güçlü yönler</h4>
                  {technology.strengths.map((item) => <p key={item}>{item}</p>)}
                </div>
                <div>
                  <h4><MinusCircle aria-hidden size={22} style={{ color: "var(--warning)" }} />Sınırlar</h4>
                  {technology.tradeoffs.map((item) => <p key={item}>{item}</p>)}
                </div>
              </div>
            </section>
            {readiness && (
              <section aria-labelledby="ai-fit" className="prose-section">
                <h2 id="ai-fit">AI ile geliştirme</h2>
                <span className="editor-tag">Editör değerlendirmesi</span>
                <p style={{ color: "var(--ink-2)" }}>{readiness.verdict}</p>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <ScoreMeter label="AI uyumu" value={readiness.aiBuildability} />
                  <ScoreMeter label="Doküman kalitesi" value={readiness.docsQuality} />
                  <ScoreMeter label="Topluluk" value={readiness.communitySupport} />
                  <ScoreMeter label="Token verimi" value={readiness.tokenEfficiency} />
                </div>
                {readiness.aiPitfalls.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 16, marginBottom: 8 }}>AI’ın sık yaptığı hatalar</h4>
                    <ul className="bullets">{readiness.aiPitfalls.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                )}
                {readiness.bestModels.length > 0 && <p className="muted small">İyi sonuç veren modeller: {readiness.bestModels.join(", ")}</p>}
              </section>
            )}
            {velocity && (
              <section aria-labelledby="velocity" className="prose-section">
                <h2 id="velocity">Hız ve üretime hazırlık</h2>
                <span className="editor-tag">Tahmin</span>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <ScoreMeter label="Prototip hızı" value={velocity.prototypeSpeed} />
                  <ScoreMeter kind="production" label="Üretime hazırlık" value={velocity.productionReadiness} />
                </div>
                <p style={{ color: "var(--ink-2)" }}>{velocity.verdict}</p>
                <p className="muted small">Prototip: {velocity.timeToPrototype} · Üretim: {velocity.timeToProductionReady}</p>
                {velocity.productionGaps.length > 0 && <ul className="bullets">{velocity.productionGaps.map((item) => <li key={item}>{item}</li>)}</ul>}
              </section>
            )}
            <section className="prose-section">
              <h2>Birlikte kullanılır</h2>
              <Related items={technology.pairsWith} />
            </section>
            {technology.alternatives.length > 0 && (
              <section className="prose-section">
                <h2>Alternatifler</h2>
                <Related items={technology.alternatives} />
              </section>
            )}
          </div>
          <aside className="rail">
            <section className="card subtle" aria-labelledby="sources-title">
              <h3 id="sources-title">Kaynaklar</h3>
              <ul className="ref-list">
                <li><BookOpen aria-hidden className="lead" size={26} /><div><small>Dokümantasyon</small><a className="value" href={technology.docsUrl} rel="noreferrer" target="_blank">{hostOf(technology.docsUrl)}</a></div><ArrowSquareOut aria-hidden size={20} style={{ color: "var(--locked)" }} /></li>
                {technology.repoUrl && <li><GithubLogo aria-hidden className="lead" size={26} /><div><small>Kod deposu</small><a className="value" href={technology.repoUrl} rel="noreferrer" target="_blank">{hostOf(technology.repoUrl).replace(/^github\.com\//, "")}</a></div><ArrowSquareOut aria-hidden size={20} style={{ color: "var(--locked)" }} /></li>}
                <li><Scales aria-hidden className="lead" size={26} /><div><small>Lisans</small><span>{technology.license}</span></div><span /></li>
                {technology.installCommand && (
                  <li style={{ gridTemplateColumns: "32px minmax(0,1fr)" }}>
                    <Terminal aria-hidden className="lead" size={26} />
                    <div style={{ minWidth: 0 }}>
                      <small>Kurulum</small>
                      <div className="install-box" style={{ marginTop: 8 }}><code>{technology.installCommand}</code><CopyButton label="Kurulum komutunu kopyala" text={technology.installCommand} /></div>
                    </div>
                  </li>
                )}
              </ul>
              {technology.tags.length > 0 && <p className="muted small" style={{ marginTop: 16 }}>{technology.tags.map((tag) => `#${tag}`).join(" ")}</p>}
            </section>
            {technology.stacks.length > 0 && (
              <section className="card" aria-labelledby="in-stacks">
                <h3 id="in-stacks">Hazır stack’lerde</h3>
                <div className="chip-group">{technology.stacks.map((stack) => <Link className="chip" href={`/workspace/catalog/stacks/${stack.slug}`} key={stack.slug}>{stack.name}</Link>)}</div>
              </section>
            )}
          </aside>
        </div>
      </section>
    </WorkspaceShell>
  );
}
