"use client";

import { CaretRight, MagnifyingGlass, Tray } from "@phosphor-icons/react/dist/ssr";
import { catalogDomainSchema, resourceTypeSchema, type CatalogDomain, type CatalogLibraryLinks, type CatalogOverview, type CatalogStackSummary, type CatalogTechnologySummary, type ResourceType } from "@devcontext/contracts";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale } from "../../../components/locale-provider";
import { PageHead } from "../../../components/page-heading";
import { TechLogo } from "../../../components/tech-logo";
import { authorizedUseTag, domainLabels, foldText, maturityLabels } from "../../../lib/catalog-labels";
import { defineCopy } from "../../../lib/i18n";
import { typeLabels } from "../../../lib/resource-labels";
import { AddToLibraryButton, Notice, useNotice } from "./catalog-actions";

const copy = defineCopy({
  tr: {
    title: "Teknoloji kataloğu",
    lead: "Projene uygun araçları keşfet ve kütüphanene ekle.",
    /** English only: the catalog content itself is written in Turkish. */
    contentLanguageNote: null as string | null,
    loadFailed: "Katalog yüklenemedi. Birazdan tekrar dene.",
    overviewCount: (technologies: number, stacks: number) => `${technologies} teknoloji · ${stacks} hazır stack`,
    technologyCount: (technologies: number) => `${technologies} teknoloji`,
    categories: "Kategoriler",
    all: "Tümü",
    search: "Katalogda ara",
    searchPlaceholder: "Teknoloji veya kullanım alanı ara",
    filterType: "Türe göre filtrele",
    allTypes: "Tüm türler",
    stacks: "Hazır stack’ler",
    emptyTitle: "Eşleşen teknoloji yok",
    emptyText: "Başka bir sözcük dene veya filtreleri temizle.",
    clearFilters: "Filtreleri temizle",
    authorizedUse: "Yalnızca yetkili kullanım",
    added: (name: string) => `${name} Kütüphanene eklendi.`,
    alreadyAdded: (name: string) => `${name} zaten Kütüphanendeydi.`,
    details: (name: string) => `${name} ayrıntıları`,
    editorNote: "AI uyumu değerlendirmeleri editör görüşüdür, ölçülmüş başarı oranı değildir.",
    sourceDate: (version: string) => ` Kaynak tarihi: ${version}.`,
  },
  en: {
    title: "Technology catalog",
    lead: "Discover tools that fit your project and add them to your Library.",
    contentLanguageNote: "Technology descriptions are currently available in Turkish only.",
    loadFailed: "The catalog could not be loaded. Try again shortly.",
    overviewCount: (technologies: number, stacks: number) => `${technologies} ${technologies === 1 ? "technology" : "technologies"} · ${stacks} ready-made ${stacks === 1 ? "stack" : "stacks"}`,
    technologyCount: (technologies: number) => `${technologies} ${technologies === 1 ? "technology" : "technologies"}`,
    categories: "Categories",
    all: "All",
    search: "Search the catalog",
    searchPlaceholder: "Search technologies or use cases",
    filterType: "Filter by type",
    allTypes: "All types",
    stacks: "Ready-made stacks",
    emptyTitle: "No matching technologies",
    emptyText: "Try another word or clear the filters.",
    clearFilters: "Clear filters",
    authorizedUse: "Authorized use only",
    added: (name: string) => `${name} added to your Library.`,
    alreadyAdded: (name: string) => `${name} was already in your Library.`,
    details: (name: string) => `${name} details`,
    editorNote: "AI fit ratings are editor assessments, not measured success rates.",
    sourceDate: (version: string) => ` Source date: ${version}.`,
  },
});

function matches(item: CatalogTechnologySummary, needle: string) {
  const haystack = foldText([item.name, item.slug, item.summary, item.category, item.tags.join(" ")].join(" "));
  return needle.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

export function StackStripItem({ stack }: { stack: CatalogStackSummary }) {
  const first = stack.highlights[0];
  return (
    <Link className="stack-strip-item" href={`/workspace/catalog/stacks/${stack.slug}`}>
      <span className="mark">{first ? <TechLogo name={first.name ?? first.slug} size={24} slug={first.slug} /> : null}</span>
      <span style={{ minWidth: 0 }}>
        <strong>{stack.name}</strong>
        <small>{stack.highlights.map((item) => item.name ?? item.slug).slice(0, 4).join(", ")}</small>
      </span>
      <CaretRight aria-hidden className="arrow" size={18} />
    </Link>
  );
}

export function CatalogClient({ overview, technologies, stacks, links: initialLinks, initialQuery, initialDomain, initialType }: {
  overview: CatalogOverview | null;
  technologies: CatalogTechnologySummary[];
  stacks: CatalogStackSummary[];
  links: CatalogLibraryLinks;
  initialQuery: string;
  initialDomain: CatalogDomain | null;
  initialType: ResourceType | null;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const [query, setQuery] = useState(initialQuery);
  const [domain, setDomain] = useState<CatalogDomain | null>(initialDomain);
  const [type, setType] = useState<ResourceType | null>(initialType);
  const [links, setLinks] = useState(initialLinks);
  const { notice, setNotice } = useNotice();

  const availableTypes = useMemo(() => resourceTypeSchema.options.filter((option) => technologies.some((item) => item.type === option)), [technologies]);
  const needle = foldText(query.trim());
  const visible = technologies
    .filter((item) => !domain || item.domain === domain)
    .filter((item) => !type || item.type === type)
    .filter((item) => !needle || matches(item, needle));
  const domainNote = domain ? overview?.domains.find((item) => item.id === domain)?.note ?? null : null;

  return (
    <section className="page">
      <PageHead lead={t.lead} title={t.title} />
      {t.contentLanguageNote && <p className="muted small" role="note" style={{ marginTop: 8 }}>{t.contentLanguageNote}</p>}
      {overview === null && <p className="note warning" role="status" style={{ marginTop: 20 }}>{t.loadFailed}</p>}
      <div className="catalog-toolbar">
        <span className="count">{overview ? t.overviewCount(overview.technologyCount, overview.stackCount) : t.technologyCount(technologies.length)}</span>
        <div aria-label={t.categories} className="pill-group" role="group">
          <button aria-pressed={domain === null} onClick={() => setDomain(null)} type="button">{t.all}</button>
          {(overview?.domains ?? []).map((item) => <button aria-pressed={domain === item.id} key={item.id} onClick={() => setDomain(item.id)} type="button">{domainLabels[locale][item.id]}</button>)}
        </div>
        <form className="search" onSubmit={(event) => event.preventDefault()} role="search">
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label={t.search} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} value={query} />
        </form>
        <select aria-label={t.filterType} className="select inline" onChange={(event) => setType(event.target.value ? resourceTypeSchema.parse(event.target.value) : null)} value={type ?? ""}>
          <option value="">{t.allTypes}</option>
          {availableTypes.map((option) => <option key={option} value={option}>{typeLabels[locale][option]}</option>)}
        </select>
      </div>
      {domainNote && <p className="note warning" role="note" style={{ marginTop: 16 }}>{domainNote}</p>}
      {stacks.length > 0 && (
        <div aria-label={t.stacks} className="stack-strip">
          <h2>{t.stacks}</h2>
          {stacks.map((stack) => <StackStripItem key={stack.slug} stack={stack} />)}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="empty">
          <span className="mark xl"><Tray aria-hidden size={34} /></span>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyText}</p>
          <button className="button" onClick={() => { setQuery(""); setDomain(null); setType(null); }} type="button">{t.clearFilters}</button>
        </div>
      ) : (
        <div className="catalog-grid">
          {visible.map((item) => (
            <article aria-label={item.name} className="catalog-card" key={item.slug}>
              <div className="identity">
                <span className="mark large"><TechLogo name={item.name} size={38} slug={item.slug} /></span>
                <div style={{ minWidth: 0 }}>
                  <strong><Link href={`/workspace/catalog/${item.slug}`}>{item.name}</Link></strong>
                  <small>{domainLabels[locale][item.domain]}</small>
                </div>
              </div>
              <p>{item.summary}</p>
              <div className="catalog-card-foot">
                <span className="meta">
                  <span className={`dot ${item.maturity}`}>{maturityLabels[locale][item.maturity]}</span>
                  <span className="host">{typeLabels[locale][item.type]}</span>
                  {item.tags.includes(authorizedUseTag) && <span className="chip" style={{ color: "var(--warning)" }}>{t.authorizedUse}</span>}
                </span>
                <AddToLibraryButton
                  name={item.name}
                  onAdded={(resourceId, created) => { setLinks((current) => ({ ...current, [item.slug]: resourceId })); setNotice(created ? t.added(item.name) : t.alreadyAdded(item.name)); }}
                  resourceId={links[item.slug] ?? null}
                  slug={item.slug}
                />
                <Link aria-label={t.details(item.name)} className="icon-button bordered" href={`/workspace/catalog/${item.slug}`} style={{ width: 40, height: 40 }}><CaretRight aria-hidden size={18} /></Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="catalog-note">{t.editorNote}{overview ? t.sourceDate(overview.version) : ""}</p>
      <Notice>{notice}</Notice>
    </section>
  );
}
