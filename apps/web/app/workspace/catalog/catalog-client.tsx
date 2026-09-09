"use client";

import { CaretRight, MagnifyingGlass, Tray } from "@phosphor-icons/react/dist/ssr";
import { catalogDomainSchema, resourceTypeSchema, type CatalogDomain, type CatalogLibraryLinks, type CatalogOverview, type CatalogStackSummary, type CatalogTechnologySummary, type ResourceType } from "@devcontext/contracts";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead } from "../../../components/page-heading";
import { TechLogo } from "../../../components/tech-logo";
import { authorizedUseTag, domainLabels, foldText, maturityLabels } from "../../../lib/catalog-labels";
import { typeLabels } from "../../../lib/resource-labels";
import { AddToLibraryButton, Notice, useNotice } from "./catalog-actions";

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
      <PageHead lead="Projene uygun araçları keşfet ve kütüphanene ekle." title="Teknoloji kataloğu" />
      {overview === null && <p className="note warning" role="status" style={{ marginTop: 20 }}>Katalog yüklenemedi. Birazdan tekrar dene.</p>}
      <div className="catalog-toolbar">
        <span className="count">{overview ? `${overview.technologyCount} teknoloji · ${overview.stackCount} hazır stack` : `${technologies.length} teknoloji`}</span>
        <div aria-label="Kategoriler" className="pill-group" role="group">
          <button aria-pressed={domain === null} onClick={() => setDomain(null)} type="button">Tümü</button>
          {(overview?.domains ?? []).map((item) => <button aria-pressed={domain === item.id} key={item.id} onClick={() => setDomain(item.id)} type="button">{domainLabels[item.id]}</button>)}
        </div>
        <form className="search" onSubmit={(event) => event.preventDefault()} role="search">
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label="Katalogda ara" onChange={(event) => setQuery(event.target.value)} placeholder="Teknoloji veya kullanım alanı ara" value={query} />
        </form>
        <select aria-label="Türe göre filtrele" className="select inline" onChange={(event) => setType(event.target.value ? resourceTypeSchema.parse(event.target.value) : null)} value={type ?? ""}>
          <option value="">Tüm türler</option>
          {availableTypes.map((option) => <option key={option} value={option}>{typeLabels[option]}</option>)}
        </select>
      </div>
      {domainNote && <p className="note warning" role="note" style={{ marginTop: 16 }}>{domainNote}</p>}
      {stacks.length > 0 && (
        <div aria-label="Hazır stack’ler" className="stack-strip">
          <h2>Hazır stack’ler</h2>
          {stacks.map((stack) => <StackStripItem key={stack.slug} stack={stack} />)}
        </div>
      )}
      {visible.length === 0 ? (
        <div className="empty">
          <span className="mark xl"><Tray size={34} /></span>
          <h2>Eşleşen teknoloji yok</h2>
          <p>Başka bir sözcük dene veya filtreleri temizle.</p>
          <button className="button" onClick={() => { setQuery(""); setDomain(null); setType(null); }} type="button">Filtreleri temizle</button>
        </div>
      ) : (
        <div className="catalog-grid">
          {visible.map((item) => (
            <article aria-label={item.name} className="catalog-card" key={item.slug}>
              <div className="identity">
                <span className="mark large"><TechLogo name={item.name} size={38} slug={item.slug} /></span>
                <div style={{ minWidth: 0 }}>
                  <strong><Link href={`/workspace/catalog/${item.slug}`}>{item.name}</Link></strong>
                  <small>{domainLabels[item.domain]}</small>
                </div>
              </div>
              <p>{item.summary}</p>
              <div className="catalog-card-foot">
                <span className="meta">
                  <span className={`dot ${item.maturity}`}>{maturityLabels[item.maturity]}</span>
                  <span className="host">{typeLabels[item.type]}</span>
                  {item.tags.includes(authorizedUseTag) && <span className="chip" style={{ color: "var(--warning)" }}>Yalnızca yetkili kullanım</span>}
                </span>
                <AddToLibraryButton
                  name={item.name}
                  onAdded={(resourceId, created) => { setLinks((current) => ({ ...current, [item.slug]: resourceId })); setNotice(created ? `${item.name} Kütüphanene eklendi.` : `${item.name} zaten Kütüphanendeydi.`); }}
                  resourceId={links[item.slug] ?? null}
                  slug={item.slug}
                />
                <Link aria-label={`${item.name} ayrıntıları`} className="icon-button bordered" href={`/workspace/catalog/${item.slug}`} style={{ width: 40, height: 40 }}><CaretRight aria-hidden size={18} /></Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="catalog-note">AI uyumu değerlendirmeleri editör görüşüdür, ölçülmüş başarı oranı değildir.{overview ? ` Kaynak tarihi: ${overview.version}.` : ""}</p>
      <Notice>{notice}</Notice>
    </section>
  );
}
