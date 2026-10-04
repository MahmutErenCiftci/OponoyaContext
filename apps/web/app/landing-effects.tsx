"use client";

import { useEffect, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { productName } from "@devcontext/contracts/brand";
import { useLocale } from "../components/locale-provider";
import { defineCopy } from "../lib/i18n";

/**
 * Sections below the fold rise in when they scroll into view. Everything is
 * visible without JavaScript and for anything already on screen at hydration;
 * only elements still below the viewport are hidden and then revealed.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const elements = [...document.querySelectorAll<HTMLElement>(".lp-reveal")];
    const below = elements.filter((element) => element.getBoundingClientRect().top > window.innerHeight);
    below.forEach((element) => element.classList.add("lp-pending"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("lp-pending");
        entry.target.classList.add("lp-in");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -10% 0px" });
    below.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return null;
}

/** A card grid whose cards light up under the pointer (a soft accent glow that follows it). */
export function SpotlightGrid({ className, children }: { className: string; children: ReactNode }) {
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const card = (event.target as HTMLElement).closest<HTMLElement>(".lp-spot");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    // Pointer coordinates are screen pixels; the page may be CSS-zoomed.
    const zoom = (card as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
    card.style.setProperty("--mx", `${(event.clientX - rect.left) / zoom}px`);
    card.style.setProperty("--my", `${(event.clientY - rect.top) / zoom}px`);
  }
  return <div className={className} onPointerMove={onPointerMove}>{children}</div>;
}

type AgentFile = { id: string; label: string; agent: string; lines: Array<{ text: string; tone?: "title" | "muted" | "head" | "locked" | "preferred" }> };

const copy = defineCopy({
  tr: {
    tabsLabel: "Örnek dışa aktarma dosyaları",
    live: "aynı kaynak",
    example: (label: string) => `${label} örneği`,
    files: [
      {
        id: "agents",
        label: "AGENTS.md",
        agent: "Codex",
        lines: [
          { text: "# Atlas Finance — Proje bağlamı", tone: "title" },
          { text: "Kişisel finans SaaS · aşama: MVP · platform: web", tone: "muted" },
          { text: "" },
          { text: "## Teknoloji kararları", tone: "head" },
          { text: "[Kilitli]  Framework: Next.js", tone: "locked" },
          { text: "[Kilitli]  Veritabanı: PostgreSQL", tone: "locked" },
          { text: "[Tercih]   ORM: Drizzle ORM", tone: "preferred" },
          { text: "[AI karar] Mimari: Fastify veya Hono" },
          { text: "" },
          { text: "## Kurallar", tone: "head" },
          { text: "- Her API girdisini Zod ile doğrula" },
          { text: "- Ölçülmüş bir ihtiyaç olmadan yeni altyapı ekleme" },
        ],
      },
      {
        id: "claude",
        label: "CLAUDE.md",
        agent: "Claude Code",
        lines: [
          { text: "# Atlas Finance", tone: "title" },
          { text: `Bu dosya ${productName} ile oluşturuldu · sürüm 3`, tone: "muted" },
          { text: "" },
          { text: "## Değiştirme", tone: "head" },
          { text: "Next.js ve PostgreSQL kilitli; başka seçenek önerme.", tone: "locked" },
          { text: "" },
          { text: "## Tercih et", tone: "head" },
          { text: "Veri erişimi için Drizzle ORM; gerekçeyle değişebilir.", tone: "preferred" },
          { text: "" },
          { text: "## Sen karar ver", tone: "head" },
          { text: "Mimari: Fastify veya Hono içinden seç, gerekçeni yaz." },
        ],
      },
      {
        id: "cursor",
        label: ".cursor/rules/*.mdc",
        agent: "Cursor",
        lines: [
          { text: "---", tone: "muted" },
          { text: "description: Atlas Finance proje bağlamı", tone: "muted" },
          { text: "alwaysApply: true", tone: "muted" },
          { text: "---", tone: "muted" },
          { text: "## Teknoloji kararları", tone: "head" },
          { text: "- Next.js (kilitli)", tone: "locked" },
          { text: "- PostgreSQL (kilitli)", tone: "locked" },
          { text: "- Drizzle ORM (tercih)", tone: "preferred" },
          { text: "## Kurallar", tone: "head" },
          { text: "- Her API girdisini Zod ile doğrula" },
        ],
      },
    ] as AgentFile[],
  },
  en: {
    tabsLabel: "Sample export files",
    live: "same source",
    example: (label: string) => `${label} example`,
    files: [
      {
        id: "agents",
        label: "AGENTS.md",
        agent: "Codex",
        lines: [
          { text: "# Atlas Finance — Project context", tone: "title" },
          { text: "Personal finance SaaS · stage: MVP · platform: web", tone: "muted" },
          { text: "" },
          { text: "## Technology decisions", tone: "head" },
          { text: "[Locked]     Framework: Next.js", tone: "locked" },
          { text: "[Locked]     Database: PostgreSQL", tone: "locked" },
          { text: "[Preferred]  ORM: Drizzle ORM", tone: "preferred" },
          { text: "[AI decides] Architecture: Fastify or Hono" },
          { text: "" },
          { text: "## Rules", tone: "head" },
          { text: "- Validate every API input with Zod" },
          { text: "- Don't add new infrastructure without a measured need" },
        ],
      },
      {
        id: "claude",
        label: "CLAUDE.md",
        agent: "Claude Code",
        lines: [
          { text: "# Atlas Finance", tone: "title" },
          { text: `Generated with ${productName} · version 3`, tone: "muted" },
          { text: "" },
          { text: "## Do not change", tone: "head" },
          { text: "Next.js and PostgreSQL are locked; don't suggest alternatives.", tone: "locked" },
          { text: "" },
          { text: "## Prefer", tone: "head" },
          { text: "Drizzle ORM for data access; it can change with a stated reason.", tone: "preferred" },
          { text: "" },
          { text: "## You decide", tone: "head" },
          { text: "Architecture: choose between Fastify and Hono and explain why." },
        ],
      },
      {
        id: "cursor",
        label: ".cursor/rules/*.mdc",
        agent: "Cursor",
        lines: [
          { text: "---", tone: "muted" },
          { text: "description: Atlas Finance project context", tone: "muted" },
          { text: "alwaysApply: true", tone: "muted" },
          { text: "---", tone: "muted" },
          { text: "## Technology decisions", tone: "head" },
          { text: "- Next.js (locked)", tone: "locked" },
          { text: "- PostgreSQL (locked)", tone: "locked" },
          { text: "- Drizzle ORM (preferred)", tone: "preferred" },
          { text: "## Rules", tone: "head" },
          { text: "- Validate every API input with Zod" },
        ],
      },
    ],
  },
});

/**
 * One source, three files: the window cycles through the exports every few
 * seconds and types each file line by line. Hovering or focusing it pauses the
 * cycle; the tabs switch by hand at any time.
 */
export function AgentFiles() {
  const t = copy[useLocale()];
  const files = t.files;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % files.length), 6_000);
    return () => window.clearInterval(timer);
  }, [paused, files.length]);

  const file = files[active] ?? files[0]!;
  return (
    <div className="lp-code" onBlur={() => setPaused(false)} onFocus={() => setPaused(true)} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <div aria-label={t.tabsLabel} className="lp-code-tabs" role="group">
        {files.map((item, index) => (
          <button aria-pressed={index === active} className="lp-code-tab" key={item.id} onClick={() => setActive(index)} type="button">
            <span>{item.label}</span><small>{item.agent}</small>
          </button>
        ))}
        <span aria-hidden="true" className="lp-code-live">{t.live}</span>
      </div>
      <pre aria-label={t.example(file.label)} className="lp-code-body" key={file.id}>
        {file.lines.map((line, index) => (
          <span className={`lp-line${line.tone ? ` ${line.tone}` : ""}`} key={index} style={{ "--i": index } as CSSProperties}>{line.text || " "}</span>
        ))}
        <span aria-hidden="true" className="lp-caret" style={{ "--i": file.lines.length } as CSSProperties} />
      </pre>
    </div>
  );
}
