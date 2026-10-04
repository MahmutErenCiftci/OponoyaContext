import type { Metadata } from "next";
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
import { defineCopy } from "../../../../lib/i18n";
import { getLocale } from "../../../../lib/locale-server";
import { typeLabels } from "../../../../lib/resource-labels";
import { loadSession } from "../../../../lib/server-session";
import { ServiceUnavailable } from "../../unavailable";
import { WorkspaceShell } from "../../workspace-shell";
import { TechnologyActions } from "../catalog-actions";

const copy = defineCopy({
  tr: {
    catalog: "Katalog",
    noneListed: "Listelenmiş değil.",
    inCatalog: "Katalogda",
    notInCatalog: "Henüz katalogda değil",
    authorizedUse: "Yalnızca yetkili kullanım",
    /** English only: the catalog content itself is written in Turkish. */
    contentLanguageNote: null as string | null,
    whenToUse: "Ne zaman uygun?",
    strengthsAndLimits: "Güçlü yönler ve sınırlar",
    strengths: "Güçlü yönler",
    limits: "Sınırlar",
    aiTitle: "AI ile geliştirme",
    editorAssessment: "Editör değerlendirmesi",
    aiFit: "AI uyumu",
    docsQuality: "Doküman kalitesi",
    community: "Topluluk",
    tokenEfficiency: "Token verimi",
    aiPitfalls: "AI’ın sık yaptığı hatalar",
    bestModels: "İyi sonuç veren modeller: ",
    velocityTitle: "Hız ve üretime hazırlık",
    estimate: "Tahmin",
    prototypeSpeed: "Prototip hızı",
    productionReadiness: "Üretime hazırlık",
    timeline: (prototype: string, production: string) => `Prototip: ${prototype} · Üretim: ${production}`,
    pairsWith: "Birlikte kullanılır",
    alternatives: "Alternatifler",
    links: "Kaynaklar",
    docs: "Dokümantasyon",
    repository: "Kod deposu",
    license: "Lisans",
    install: "Kurulum",
    copyInstall: "Kurulum komutunu kopyala",
    inStacks: "Hazır stack’lerde",
  },
  en: {
    catalog: "Catalog",
    noneListed: "None listed.",
    inCatalog: "In the catalog",
    notInCatalog: "Not in the catalog yet",
    authorizedUse: "Authorized use only",
    contentLanguageNote: "Technology descriptions are currently available in Turkish only.",
    whenToUse: "When does it fit?",
    strengthsAndLimits: "Strengths and limits",
    strengths: "Strengths",
    limits: "Limits",
    aiTitle: "Building with AI",
    editorAssessment: "Editor assessment",
    aiFit: "AI fit",
    docsQuality: "Docs quality",
    community: "Community",
    tokenEfficiency: "Token efficiency",
    aiPitfalls: "Common AI mistakes",
    bestModels: "Models that work well: ",
    velocityTitle: "Speed and production readiness",
    estimate: "Estimate",
    prototypeSpeed: "Prototype speed",
    productionReadiness: "Production readiness",
    timeline: (prototype: string, production: string) => `Prototype: ${prototype} · Production: ${production}`,
    pairsWith: "Often used with",
    alternatives: "Alternatives",
    links: "Links",
    docs: "Documentation",
    repository: "Repository",
    license: "License",
    install: "Install",
    copyInstall: "Copy install command",
    inStacks: "In ready-made stacks",
  },
});

type Copy = (typeof copy)["tr"];

/** The entity name in the tab title; the lookup is shared with the page through the per-request cache. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [session, locale] = await Promise.all([loadSession(), getLocale()]);
  const technology = session.status === "authenticated" ? await getCatalogTechnology(session.cookieHeader, slug) : null;
  return { title: technology ? technology.name : copy[locale].catalog };
}

function hostOf(url: string) {
  try { return new URL(url).host.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, ""); } catch { return url; }
}

function Related({ items, t }: { items: CatalogReference[]; t: Copy }) {
  if (items.length === 0) return <p className="muted">{t.noneListed}</p>;
  return (
    <div className="related-grid">
      {items.map((item) => item.known
        ? <Link href={`/workspace/catalog/${item.slug}`} key={item.slug}><span className="mark"><TechLogo name={item.name ?? item.slug} size={24} slug={item.slug} /></span><span><strong>{item.name}</strong><small>{t.inCatalog}</small></span></Link>
        : <span className="chip" key={item.slug} title={t.notInCatalog}>{item.slug}</span>)}
    </div>
  );
}

export default async function CatalogTechnologyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await loadSession();
  if (session.status === "unavailable") return <ServiceUnavailable />;
  if (session.status === "anonymous") redirect("/auth?mode=sign-in");
  const { user, cookieHeader } = session;
  const [technology, links, locale] = await Promise.all([getCatalogTechnology(cookieHeader, slug), getCatalogLibraryLinks(cookieHeader), getLocale()]);
  if (!technology) notFound();
  const t = copy[locale];
  const readiness = technology.readiness;
  const velocity = technology.velocity;

  return (
    <WorkspaceShell active="Catalog" user={user}>
      <section className="page">
        <Breadcrumb items={[{ label: t.catalog, href: "/workspace/catalog" }, { label: technology.name }]} />
        <div className="tech-hero">
          <span className="mark xl"><TechLogo name={technology.name} size={44} slug={technology.slug} /></span>
          <div>
            <h1 className="page-title">{technology.name}</h1>
            <p className="sub">{typeLabels[locale][technology.type]} · {domainLabels[locale][technology.domain]} · {technology.category}</p>
          </div>
          <TechnologyActions name={technology.name} resourceId={links[technology.slug] ?? null} slug={technology.slug} />
        </div>
        <p className="page-lead" style={{ marginTop: 18 }}>{technology.summary}</p>
        {t.contentLanguageNote && <p className="muted small" role="note" style={{ marginTop: 8 }}>{t.contentLanguageNote}</p>}
        <div className="chip-group" style={{ marginTop: 14 }}>
          <span className="chip">{popularityLabels[locale][technology.popularity]}</span>
          <span className="chip">{maturityLabels[locale][technology.maturity]}</span>
          <span className="chip">{levelLabels[locale][technology.learningCurve]}</span>
          <span className="chip">{pricingLabels[locale][technology.pricing]}</span>
          {technology.tags.includes(authorizedUseTag) && <span className="chip" style={{ color: "var(--warning)" }}>{t.authorizedUse}</span>}
        </div>

        <div className="split" style={{ marginTop: 20 }}>
          <div>
            <section className="prose-section">
              <h2>{t.whenToUse}</h2>
              <ul className="bullets">
                <li>{technology.whatFor}</li>
                <li>{technology.whereUsed}</li>
                <li>{technology.commonUse}</li>
              </ul>
            </section>
            <section className="prose-section">
              <h2>{t.strengthsAndLimits}</h2>
              <div className="two-col">
                <div>
                  <h4><CheckCircle aria-hidden size={22} style={{ color: "var(--success)" }} />{t.strengths}</h4>
                  {technology.strengths.map((item) => <p key={item}>{item}</p>)}
                </div>
                <div>
                  <h4><MinusCircle aria-hidden size={22} style={{ color: "var(--warning)" }} />{t.limits}</h4>
                  {technology.tradeoffs.map((item) => <p key={item}>{item}</p>)}
                </div>
              </div>
            </section>
            {readiness && (
              <section aria-labelledby="ai-fit" className="prose-section">
                <h2 id="ai-fit">{t.aiTitle}</h2>
                <span className="editor-tag">{t.editorAssessment}</span>
                <p style={{ color: "var(--ink-2)" }}>{readiness.verdict}</p>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <ScoreMeter label={t.aiFit} locale={locale} value={readiness.aiBuildability} />
                  <ScoreMeter label={t.docsQuality} locale={locale} value={readiness.docsQuality} />
                  <ScoreMeter label={t.community} locale={locale} value={readiness.communitySupport} />
                  <ScoreMeter label={t.tokenEfficiency} locale={locale} value={readiness.tokenEfficiency} />
                </div>
                {readiness.aiPitfalls.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 16, marginBottom: 8 }}>{t.aiPitfalls}</h4>
                    <ul className="bullets">{readiness.aiPitfalls.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                )}
                {readiness.bestModels.length > 0 && <p className="muted small">{t.bestModels}{readiness.bestModels.join(", ")}</p>}
              </section>
            )}
            {velocity && (
              <section aria-labelledby="velocity" className="prose-section">
                <h2 id="velocity">{t.velocityTitle}</h2>
                <span className="editor-tag">{t.estimate}</span>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <ScoreMeter label={t.prototypeSpeed} locale={locale} value={velocity.prototypeSpeed} />
                  <ScoreMeter kind="production" label={t.productionReadiness} locale={locale} value={velocity.productionReadiness} />
                </div>
                <p style={{ color: "var(--ink-2)" }}>{velocity.verdict}</p>
                <p className="muted small">{t.timeline(velocity.timeToPrototype, velocity.timeToProductionReady)}</p>
                {velocity.productionGaps.length > 0 && <ul className="bullets">{velocity.productionGaps.map((item) => <li key={item}>{item}</li>)}</ul>}
              </section>
            )}
            <section className="prose-section">
              <h2>{t.pairsWith}</h2>
              <Related items={technology.pairsWith} t={t} />
            </section>
            {technology.alternatives.length > 0 && (
              <section className="prose-section">
                <h2>{t.alternatives}</h2>
                <Related items={technology.alternatives} t={t} />
              </section>
            )}
          </div>
          <aside className="rail">
            <section className="card subtle" aria-labelledby="sources-title">
              <h3 id="sources-title">{t.links}</h3>
              <ul className="ref-list">
                <li><BookOpen aria-hidden className="lead" size={26} /><div><small>{t.docs}</small><a className="value" href={technology.docsUrl} rel="noreferrer" target="_blank">{hostOf(technology.docsUrl)}</a></div><ArrowSquareOut aria-hidden size={20} style={{ color: "var(--locked)" }} /></li>
                {technology.repoUrl && <li><GithubLogo aria-hidden className="lead" size={26} /><div><small>{t.repository}</small><a className="value" href={technology.repoUrl} rel="noreferrer" target="_blank">{hostOf(technology.repoUrl).replace(/^github\.com\//, "")}</a></div><ArrowSquareOut aria-hidden size={20} style={{ color: "var(--locked)" }} /></li>}
                <li><Scales aria-hidden className="lead" size={26} /><div><small>{t.license}</small><span>{technology.license}</span></div><span /></li>
                {technology.installCommand && (
                  <li style={{ gridTemplateColumns: "32px minmax(0,1fr)" }}>
                    <Terminal aria-hidden className="lead" size={26} />
                    <div style={{ minWidth: 0 }}>
                      <small>{t.install}</small>
                      <div className="install-box" style={{ marginTop: 8 }}><code>{technology.installCommand}</code><CopyButton label={t.copyInstall} text={technology.installCommand} /></div>
                    </div>
                  </li>
                )}
              </ul>
              {technology.tags.length > 0 && <p className="muted small" style={{ marginTop: 16 }}>{technology.tags.map((tag) => `#${tag}`).join(" ")}</p>}
            </section>
            {technology.stacks.length > 0 && (
              <section className="card" aria-labelledby="in-stacks">
                <h3 id="in-stacks">{t.inStacks}</h3>
                <div className="chip-group">{technology.stacks.map((stack) => <Link className="chip" href={`/workspace/catalog/stacks/${stack.slug}`} key={stack.slug}>{stack.name}</Link>)}</div>
              </section>
            )}
          </aside>
        </div>
      </section>
    </WorkspaceShell>
  );
}
