"use client";

import type { CurrentUser } from "@devcontext/contracts";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Books,
  CaretDoubleLeft,
  Compass,
  CreditCard,
  FolderSimple,
  Gear,
  House,
  List,
  Megaphone,
  Plus,
  Stack,
  UserCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { BrandMark } from "../../components/brand-mark";
import { CommandPalette } from "../../components/command-palette";
import { ThemeToggle } from "../../components/theme-toggle";
import { sidebarCookie } from "../../lib/sidebar";
import type { Theme } from "../../lib/theme";
import { LogoutButton } from "./logout-button";
import type { WorkspaceSection } from "./workspace-shell";

type NavItem = { id: WorkspaceSection; label: string; href: string; icon: Icon };

/** Where the work happens: the left sidebar. */
export const navigationGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Çalışma alanı",
    items: [
      { id: "Overview", label: "Genel bakış", href: "/workspace", icon: House },
      { id: "Projects", label: "Projeler", href: "/workspace/projects", icon: FolderSimple },
      { id: "Library", label: "Kütüphane", href: "/workspace/library", icon: Books },
    ],
  },
  {
    label: "Yapılandırma",
    items: [
      { id: "Profiles", label: "Profiller", href: "/workspace/profiles", icon: UserCircle },
      { id: "Recipes", label: "Tarifler", href: "/workspace/recipes", icon: BookOpen },
    ],
  },
  {
    label: "Hesap",
    items: [
      { id: "Plan", label: "Abonelik", href: "/workspace/billing", icon: CreditCard },
      { id: "Settings", label: "Ayarlar", href: "/workspace/settings", icon: Gear },
    ],
  },
];

/**
 * Learning and discovery: the top bar. Future informational sections
 * (guides, community) belong here, never in the sidebar.
 */
export const discoverNavigation: Array<{ id: WorkspaceSection | "News"; label: string; href: string; icon: Icon }> = [
  { id: "Catalog", label: "Katalog", href: "/workspace/catalog", icon: Compass },
  { id: "News", label: "Yenilikler", href: "/workspace#yenilikler", icon: Megaphone },
];

/** The top bar tucks away while scrolling down and returns on the way up, so it never covers the page for long. */
function useTopbarTucked() {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    function onScroll() {
      const current = window.scrollY;
      if (Math.abs(current - last) < 6) return;
      setTucked(current > last && current > 120);
      last = current;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return tucked;
}

/**
 * Workspace frame: a left sidebar with every section (collapsible on desktop,
 * an off-canvas drawer on phones) and a slim top bar for search, theme and
 * account. The collapsed state lives in a cookie so the server renders the
 * chosen width without a flash.
 */
export function WorkspaceFrame({ active, theme, user, initialCollapsed, children }: {
  active: WorkspaceSection | null;
  theme: Theme;
  user: CurrentUser | null;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const tucked = useTopbarTucked();
  const topbar = useRef<HTMLElement>(null);

  useEffect(() => {
    function dismiss(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof KeyboardEvent) setMobileOpen(false);
      topbar.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        if (event instanceof KeyboardEvent || !details.contains(event.target as Node)) {
          details.open = false;
          if (event instanceof KeyboardEvent) details.querySelector("summary")?.focus();
        }
      });
    }
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => { document.removeEventListener("click", dismiss); document.removeEventListener("keydown", dismiss); };
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookie(next);
  }

  return (
    <div className="workspace-shell" data-sidebar={collapsed ? "collapsed" : "expanded"} data-mobile-nav={mobileOpen ? "open" : "closed"}>
      <a className="skip-link" href="#workspace-content">İçeriğe geç</a>
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link className="brand" href="/workspace" onClick={() => setMobileOpen(false)}><BrandMark /></Link>
          <button aria-label="Menüyü kapat" className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} type="button"><X aria-hidden size={22} /></button>
        </div>
        <nav aria-label="Çalışma alanı" className="sidebar-nav workspace-navigation">
          {navigationGroups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <p className="sidebar-group-label"><span>{group.label}</span></p>
              {group.items.map((item) => {
                const current = active === item.id;
                return (
                  <Link aria-current={current ? "page" : undefined} className="sidebar-link" href={item.href} key={item.id} onClick={() => setMobileOpen(false)}>
                    <span aria-hidden="true" className="sidebar-icon"><item.icon size={22} weight={current ? "fill" : "regular"} /></span>
                    <span className="sidebar-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          {/* Phones have no room for the top bar links, so the drawer repeats them. */}
          <div className="sidebar-group sidebar-discover">
            <p className="sidebar-group-label"><span>Keşfet</span></p>
            {discoverNavigation.map((item) => (
              <Link className="sidebar-link" href={item.href} key={item.id} onClick={() => setMobileOpen(false)}>
                <span aria-hidden="true" className="sidebar-icon"><item.icon size={22} /></span>
                <span className="sidebar-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
        <div className="sidebar-foot">
          {user && (
            <Link className="sidebar-cta" href="/workspace/projects?new=1" onClick={() => setMobileOpen(false)}>
              <span aria-hidden="true" className="sidebar-icon"><Plus size={20} weight="bold" /></span>
              <span className="sidebar-label">Yeni proje</span>
            </Link>
          )}
          <button aria-expanded={!collapsed} aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"} className="sidebar-toggle" onClick={toggleCollapsed} type="button">
            <span aria-hidden="true" className="sidebar-icon"><CaretDoubleLeft size={18} /></span>
            <span className="sidebar-label">Daralt</span>
          </button>
        </div>
      </aside>
      <button aria-hidden="true" className="sidebar-scrim" onClick={() => setMobileOpen(false)} tabIndex={-1} type="button" />
      <div className="workspace-column">
        <header className={`topbar${tucked ? " tucked" : ""}`} ref={topbar}>
          <button aria-expanded={mobileOpen} aria-label="Menüyü aç" className="icon-button topbar-menu" onClick={() => setMobileOpen(true)} type="button"><List aria-hidden size={24} /></button>
          <Link className="brand topbar-brand" href="/workspace"><BrandMark /></Link>
          <nav aria-label="Keşfet" className="topbar-nav">
            {discoverNavigation.map((item) => (
              <Link aria-current={active === item.id ? "page" : undefined} href={item.href} key={item.id}>
                <item.icon aria-hidden size={18} weight={active === item.id ? "fill" : "regular"} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          {user && <CommandPalette variant="field" />}
          <div className="topbar-tools">
            <ThemeToggle initialTheme={theme} />
            {user && (
              <details className="header-menu account-menu">
                <summary aria-label="Hesap menüsü"><span className="avatar">{user.name.trim().slice(0, 1).toUpperCase() || "?"}</span></summary>
                <div className="header-menu-panel">
                  <div className="account-info"><strong>{user.name}</strong><small>{user.email}</small></div>
                  <Link href="/workspace/settings"><Gear aria-hidden size={18} />Hesap ayarları</Link>
                  <Link href="/workspace/profiles"><Stack aria-hidden size={18} />Profiller</Link>
                  <LogoutButton />
                </div>
              </details>
            )}
          </div>
        </header>
        <main id="workspace-content">{children}</main>
      </div>
    </div>
  );
}
