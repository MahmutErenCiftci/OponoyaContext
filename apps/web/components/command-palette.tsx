"use client";

import { searchResponseSchema, type SearchResult } from "@devcontext/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { defineCopy } from "../lib/i18n";
import { useLocale } from "./locale-provider";

type Action = { id: string; label: string; hint: string; href: string; kind: "action" | SearchResult["kind"] };
type QuickActionId = "new-project" | "add-resource" | "new-profile" | "go-library" | "go-catalog" | "go-projects" | "go-profiles" | "go-recipes" | "go-plan" | "go-settings";

const quickActionTargets: Array<{ id: QuickActionId; href: string }> = [
  { id: "new-project", href: "/workspace/projects?new=1" },
  { id: "add-resource", href: "/workspace/library?add=1" },
  { id: "new-profile", href: "/workspace/profiles?new=1" },
  { id: "go-library", href: "/workspace/library" },
  { id: "go-catalog", href: "/workspace/catalog" },
  { id: "go-projects", href: "/workspace/projects" },
  { id: "go-profiles", href: "/workspace/profiles" },
  { id: "go-recipes", href: "/workspace/recipes" },
  { id: "go-plan", href: "/workspace/billing#gelisim-plani" },
  { id: "go-settings", href: "/workspace/settings" },
];

const copy = defineCopy({
  tr: {
    actions: {
      "new-project": { label: "Yeni proje", hint: "Proje oluşturucuyu aç" },
      "add-resource": { label: "Kaynak ekle", hint: "Bir araç, bileşen veya kural kaydet" },
      "new-profile": { label: "Yeni profil", hint: "Tekrar kullanılabilir kararları paketle" },
      "go-library": { label: "Kütüphaneyi aç", hint: "Kayıtlı kaynaklarına göz at" },
      "go-catalog": { label: "Kataloğu aç", hint: "Teknolojileri ve hazır stack’leri keşfet" },
      "go-projects": { label: "Projeleri aç", hint: "Proje listesine git" },
      "go-profiles": { label: "Profilleri aç", hint: "Stack, tasarım, AI ve dağıtım profilleri" },
      "go-recipes": { label: "Tarifleri aç", hint: "Profilleri tekrar kullanılabilir tariflerde birleştir" },
      "go-plan": { label: "Gelişim planını aç", hint: "Abonelik, V1–V3 planı ve Pro" },
      "go-settings": { label: "Ayarları aç", hint: "Hesap, görünüm, veri aktarımı ve gizlilik" },
    } satisfies Record<QuickActionId, { label: string; hint: string }>,
    kinds: {
      action: "İşlemler",
      resource: "Kaynaklar",
      project: "Projeler",
      profile: "Profiller",
      recipe: "Tarifler",
    } satisfies Record<SearchResult["kind"] | "action", string>,
    archived: " · arşivde",
    search: "Çalışma alanında ara",
    searchTitle: "Ara (Ctrl+K)",
    trigger: "Ara veya hızlı işlem…",
    inputLabel: "Kaynak, proje ve profil ara",
    placeholder: "Kaynak, proje veya profil ara…",
    close: "Aramayı kapat",
    unreachable: "Arama hizmetine ulaşılamıyor. Tekrar dene.",
    noResults: (query: string) => `“${query}” için çalışma alanında sonuç yok.`,
    searching: "Aranıyor…",
    keySelect: "↑↓ seç",
    keyOpen: "↵ aç",
    keyClose: "esc kapat",
  },
  en: {
    actions: {
      "new-project": { label: "New project", hint: "Open the project builder" },
      "add-resource": { label: "Add resource", hint: "Save a tool, component or rule" },
      "new-profile": { label: "New profile", hint: "Package reusable decisions" },
      "go-library": { label: "Open Library", hint: "Browse your saved resources" },
      "go-catalog": { label: "Open Catalog", hint: "Discover technologies and ready-made stacks" },
      "go-projects": { label: "Open Projects", hint: "Go to the project list" },
      "go-profiles": { label: "Open Profiles", hint: "Stack, design, AI and deployment profiles" },
      "go-recipes": { label: "Open Recipes", hint: "Combine profiles into reusable recipes" },
      "go-plan": { label: "Open the development plan", hint: "Subscription, the V1–V3 plan and Pro" },
      "go-settings": { label: "Open Settings", hint: "Account, appearance, import and export, and privacy" },
    },
    kinds: {
      action: "Actions",
      resource: "Resources",
      project: "Projects",
      profile: "Profiles",
      recipe: "Recipes",
    },
    archived: " · archived",
    search: "Search the workspace",
    searchTitle: "Search (Ctrl+K)",
    trigger: "Search or run a quick action…",
    inputLabel: "Search resources, projects and profiles",
    placeholder: "Search resources, projects or profiles…",
    close: "Close search",
    unreachable: "The search service can't be reached. Try again.",
    noResults: (query: string) => `No results in your workspace for “${query}”.`,
    searching: "Searching…",
    keySelect: "↑↓ select",
    keyOpen: "↵ open",
    keyClose: "esc close",
  },
});

function hrefFor(result: SearchResult) {
  switch (result.kind) {
    case "resource":
      return `/workspace/library?q=${encodeURIComponent(result.name)}${result.archived ? "&view=archived" : ""}`;
    case "project":
      return `/workspace/projects/${result.id}`;
    case "profile":
      return `/workspace/profiles/${result.id}`;
    case "recipe":
      return `/workspace/recipes/${result.id}`;
  }
}

/**
 * Workspace-wide search and quick actions. Opens with the header button or
 * Ctrl/Cmd+K; results are owner-scoped by the API and navigable by keyboard.
 */
export function CommandPalette({ variant = "icon" }: { variant?: "icon" | "field" }) {
  const router = useRouter();
  const t = copy[useLocale()];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(`/api/search?${new URLSearchParams({ q: trimmed, limit: "6" })}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        const parsed = searchResponseSchema.parse(await response.json());
        setResults(parsed.results);
        setActive(0);
        setState("idle");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setState("error");
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const trimmed = query.trim();
  const items: Action[] = trimmed
    ? results.map((result) => ({ id: `${result.kind}-${result.id}`, label: result.name, hint: `${result.subtitle ?? ""}${result.archived ? t.archived : ""}`.replace(/^ · /, ""), href: hrefFor(result), kind: result.kind }))
    : quickActionTargets.map(({ id, href }): Action => ({ id, href, kind: "action", ...t.actions[id] }));
  const grouped = items.reduce<Array<{ kind: Action["kind"]; items: Action[] }>>((groups, item) => {
    const group = groups.find((entry) => entry.kind === item.kind);
    if (group) group.items.push(item);
    else groups.push({ kind: item.kind, items: [item] });
    return groups;
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setState("idle");
    setActive(0);
  }

  function go(item: Action) {
    close();
    router.push(item.href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) go(item);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <>
      {variant === "field" ? (
        <button aria-haspopup="dialog" aria-label={t.search} className="search-trigger" onClick={() => setOpen(true)} title={t.searchTitle} type="button">
          <MagnifyingGlass aria-hidden size={18} />
          <span className="search-trigger-text">{t.trigger}</span>
          <kbd>Ctrl K</kbd>
        </button>
      ) : (
        <button aria-haspopup="dialog" aria-label={t.search} className="icon-button" onClick={() => setOpen(true)} title={t.searchTitle} type="button">
          <MagnifyingGlass aria-hidden size={24} />
        </button>
      )}
      {open && (
        <div className="drawer-backdrop dialog-center" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }} role="presentation">
          <section aria-label={t.search} aria-modal="true" className="dialog" role="dialog">
            <div className="palette-input">
              <MagnifyingGlass aria-hidden size={22} />
              <input
                aria-activedescendant={items[active] ? `palette-item-${items[active].id}` : undefined}
                aria-autocomplete="list"
                aria-controls="palette-results"
                aria-expanded="true"
                aria-label={t.inputLabel}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t.placeholder}
                ref={inputRef}
                role="combobox"
                value={query}
              />
              <button aria-label={t.close} className="icon-button" onClick={close} type="button"><X aria-hidden size={20} /></button>
            </div>
            <div className="palette-body" id="palette-results" role="listbox">
              {state === "error" && <p className="palette-status" role="alert">{t.unreachable}</p>}
              {trimmed && state !== "error" && items.length === 0 && state !== "loading" && <p className="palette-status">{t.noResults(trimmed)}</p>}
              {grouped.map((group) => (
                <div className="palette-group" key={group.kind}>
                  <span className="palette-group-label">{t.kinds[group.kind]}</span>
                  {group.items.map((item) => {
                    const index = items.indexOf(item);
                    return (
                      <button
                        aria-selected={index === active}
                        className={`palette-item${index === active ? " active" : ""}`}
                        id={`palette-item-${item.id}`}
                        key={item.id}
                        onClick={() => go(item)}
                        onMouseEnter={() => setActive(index)}
                        role="option"
                        type="button"
                      >
                        <strong>{item.label}</strong>
                        <small>{item.hint}</small>
                      </button>
                    );
                  })}
                </div>
              ))}
              {state === "loading" && <p className="palette-status">{t.searching}</p>}
            </div>
            <footer className="palette-footer"><span>{t.keySelect}</span><span>{t.keyOpen}</span><span>{t.keyClose}</span></footer>
          </section>
        </div>
      )}
    </>
  );
}
