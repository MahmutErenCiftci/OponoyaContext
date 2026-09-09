"use client";

import type { CurrentUser } from "@devcontext/contracts";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { BookOpen, CaretDown, CreditCard, Gear, Stack, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { CommandPalette } from "../../components/command-palette";
import { ThemeToggle } from "../../components/theme-toggle";
import type { Theme } from "../../lib/theme";
import { LogoutButton } from "./logout-button";
import type { WorkspaceSection } from "./workspace-shell";

export const primaryNavigation = [
  { id: "Overview", label: "Genel bakış", href: "/workspace" },
  { id: "Projects", label: "Projeler", href: "/workspace/projects" },
  { id: "Library", label: "Kütüphane", href: "/workspace/library" },
  { id: "Catalog", label: "Katalog", href: "/workspace/catalog" },
] as const;

const secondary = [
  { id: "Profiles", label: "Profiller", href: "/workspace/profiles", icon: UserCircle },
  { id: "Recipes", label: "Tarifler", href: "/workspace/recipes", icon: BookOpen },
  { id: "Plan", label: "Abonelik", href: "/workspace/billing", icon: CreditCard },
  { id: "Settings", label: "Ayarlar", href: "/workspace/settings", icon: Gear },
] as const;

/** Horizontal workspace header: brand, four primary links, a closed "Daha fazla" menu, search, theme and account. */
export function WorkspaceNavigation({ active, theme, user }: { active: WorkspaceSection | null; theme: Theme; user: CurrentUser | null }) {
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    function dismiss(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      header.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
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
  const moreSelected = secondary.some((item) => item.id === active);
  return (
    <header className="app-header" ref={header}>
      <Link className="brand" href="/workspace"><span className="brand-mark">D</span><span>DevContext</span></Link>
      <nav aria-label="Çalışma alanı" className="main-nav workspace-navigation">
        {primaryNavigation.map((item) => <Link aria-current={active === item.id ? "page" : undefined} href={item.href} key={item.id}>{item.label}</Link>)}
        <details className={`header-menu${moreSelected ? " selected" : ""}`}>
          <summary aria-haspopup="menu">Daha fazla <CaretDown aria-hidden size={16} /></summary>
          <div className="header-menu-panel">
            {secondary.map((item) => <Link aria-current={active === item.id ? "page" : undefined} href={item.href} key={item.id}><item.icon aria-hidden size={20} />{item.label}</Link>)}
          </div>
        </details>
      </nav>
      <div className="header-tools">
        {user && <CommandPalette />}
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
  );
}
