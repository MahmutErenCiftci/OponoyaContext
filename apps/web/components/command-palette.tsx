"use client";

import { searchResponseSchema, type SearchResult } from "@devcontext/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";

type Action = { id: string; label: string; hint: string; href: string; kind: "action" | SearchResult["kind"] };

const quickActions: Action[] = [
  { id: "new-project", label: "Yeni proje", hint: "Proje oluşturucuyu aç", href: "/workspace/projects?new=1", kind: "action" },
  { id: "add-resource", label: "Kaynak ekle", hint: "Bir araç, bileşen veya kural kaydet", href: "/workspace/library?add=1", kind: "action" },
  { id: "new-profile", label: "Yeni profil", hint: "Tekrar kullanılabilir kararları paketle", href: "/workspace/profiles?new=1", kind: "action" },
  { id: "go-library", label: "Kütüphaneyi aç", hint: "Kayıtlı kaynaklarına göz at", href: "/workspace/library", kind: "action" },
  { id: "go-catalog", label: "Kataloğu aç", hint: "Teknolojileri ve hazır stack’leri keşfet", href: "/workspace/catalog", kind: "action" },
  { id: "go-projects", label: "Projeleri aç", hint: "Proje listesine git", href: "/workspace/projects", kind: "action" },
  { id: "go-profiles", label: "Profilleri aç", hint: "Stack, tasarım, AI ve dağıtım profilleri", href: "/workspace/profiles", kind: "action" },
];

const kindLabels: Record<SearchResult["kind"] | "action", string> = {
  action: "İşlemler",
  resource: "Kaynaklar",
  project: "Projeler",
  profile: "Profiller",
  recipe: "Tarifler",
};

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
export function CommandPalette() {
  const router = useRouter();
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
    ? results.map((result) => ({ id: `${result.kind}-${result.id}`, label: result.name, hint: `${result.subtitle ?? ""}${result.archived ? " · arşivde" : ""}`.replace(/^ · /, ""), href: hrefFor(result), kind: result.kind }))
    : quickActions;
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
      <button aria-haspopup="dialog" aria-label="Çalışma alanında ara" className="icon-button" onClick={() => setOpen(true)} title="Ara (Ctrl+K)" type="button">
        <MagnifyingGlass aria-hidden size={24} />
      </button>
      {open && (
        <div className="drawer-backdrop dialog-center" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }} role="presentation">
          <section aria-label="Çalışma alanında ara" aria-modal="true" className="dialog" role="dialog">
            <div className="palette-input">
              <MagnifyingGlass aria-hidden size={22} />
              <input
                aria-activedescendant={items[active] ? `palette-item-${items[active].id}` : undefined}
                aria-autocomplete="list"
                aria-controls="palette-results"
                aria-expanded="true"
                aria-label="Kaynak, proje ve profil ara"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Kaynak, proje veya profil ara…"
                ref={inputRef}
                role="combobox"
                value={query}
              />
              <button aria-label="Aramayı kapat" className="icon-button" onClick={close} type="button"><X aria-hidden size={20} /></button>
            </div>
            <div className="palette-body" id="palette-results" role="listbox">
              {state === "error" && <p className="palette-status" role="alert">Arama hizmetine ulaşılamıyor. Tekrar dene.</p>}
              {trimmed && state !== "error" && items.length === 0 && state !== "loading" && <p className="palette-status">“{trimmed}” için çalışma alanında sonuç yok.</p>}
              {grouped.map((group) => (
                <div className="palette-group" key={group.kind}>
                  <span className="palette-group-label">{kindLabels[group.kind]}</span>
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
              {state === "loading" && <p className="palette-status">Aranıyor…</p>}
            </div>
            <footer className="palette-footer"><span>↑↓ gezin</span><span>↵ aç</span><span>esc kapat</span></footer>
          </section>
        </div>
      )}
    </>
  );
}
