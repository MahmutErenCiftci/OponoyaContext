"use client";

import type { CurrentUser } from "@devcontext/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Books,
  CaretDoubleLeft,
  ChartBar,
  ChatCircleDots,
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
import { DrawerFrame } from "../../components/drawer";
import { FeedbackForm } from "../../components/feedback-form";
import { LanguageSwitch } from "../../components/language-switch";
import { useLocale } from "../../components/locale-provider";
import { ThemeToggle } from "../../components/theme-toggle";
import { defineCopy, type Locale } from "../../lib/i18n";
import { sidebarCookie } from "../../lib/sidebar";
import type { Theme } from "../../lib/theme";
import { LogoutButton } from "./logout-button";
import type { WorkspaceSection } from "./workspace-shell";

type NavItem = { id: WorkspaceSection; label: string; href: string; icon: Icon };
type NavGroup = { label: string; items: NavItem[] };
type DiscoverItem = { id: WorkspaceSection | "News"; label: string; href: string; icon: Icon };

const copy = defineCopy({
  tr: {
    sections: {
      Overview: "Genel bakış",
      Projects: "Projeler",
      Library: "Kütüphane",
      Profiles: "Profiller",
      Recipes: "Tarifler",
      Plan: "Abonelik",
      Settings: "Ayarlar",
      Feedback: "Geri bildirim",
      Admin: "Yönetim paneli",
      Catalog: "Katalog",
      News: "Yenilikler",
    },
    groups: { workspace: "Çalışma alanı", configuration: "Yapılandırma", account: "Hesap", admin: "Yönetim", discover: "Keşfet" },
    skipLink: "İçeriğe geç",
    closeMenu: "Menüyü kapat",
    openMenu: "Menüyü aç",
    workspaceNav: "Çalışma alanı",
    discoverNav: "Keşfet",
    newProject: "Yeni proje",
    expandSidebar: "Kenar çubuğunu genişlet",
    collapseSidebar: "Kenar çubuğunu daralt",
    collapse: "Daralt",
    feedbackHint: "Öneri, şikayet ya da hata bildir",
    feedback: "Geri bildirim",
    accountMenu: "Hesap menüsü",
    accountSettings: "Hesap ayarları",
    profiles: "Profiller",
    adminPanel: "Yönetim paneli",
    feedbackDrawerTitle: "Geri bildirim gönder",
    feedbackDrawerSubtitle: "Öneri, şikayet ya da hata: hepsini okuyoruz.",
  },
  en: {
    sections: {
      Overview: "Overview",
      Projects: "Projects",
      Library: "Library",
      Profiles: "Profiles",
      Recipes: "Recipes",
      Plan: "Subscription",
      Settings: "Settings",
      Feedback: "Feedback",
      Admin: "Admin panel",
      Catalog: "Catalog",
      News: "What's new",
    },
    groups: { workspace: "Workspace", configuration: "Configuration", account: "Account", admin: "Admin", discover: "Discover" },
    skipLink: "Skip to content",
    closeMenu: "Close menu",
    openMenu: "Open menu",
    workspaceNav: "Workspace",
    discoverNav: "Discover",
    newProject: "New project",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    collapse: "Collapse",
    feedbackHint: "Send a suggestion, complaint or bug report",
    feedback: "Feedback",
    accountMenu: "Account menu",
    accountSettings: "Account settings",
    profiles: "Profiles",
    adminPanel: "Admin panel",
    feedbackDrawerTitle: "Send feedback",
    feedbackDrawerSubtitle: "Suggestion, complaint or bug: we read them all.",
  },
});

function buildNavigationGroups(locale: Locale): NavGroup[] {
  const { groups, sections } = copy[locale];
  return [
    {
      label: groups.workspace,
      items: [
        { id: "Overview", label: sections.Overview, href: "/workspace", icon: House },
        { id: "Projects", label: sections.Projects, href: "/workspace/projects", icon: FolderSimple },
        { id: "Library", label: sections.Library, href: "/workspace/library", icon: Books },
      ],
    },
    {
      label: groups.configuration,
      items: [
        { id: "Profiles", label: sections.Profiles, href: "/workspace/profiles", icon: UserCircle },
        { id: "Recipes", label: sections.Recipes, href: "/workspace/recipes", icon: BookOpen },
      ],
    },
    {
      label: groups.account,
      items: [
        { id: "Plan", label: sections.Plan, href: "/workspace/billing", icon: CreditCard },
        { id: "Settings", label: sections.Settings, href: "/workspace/settings", icon: Gear },
        { id: "Feedback", label: sections.Feedback, href: "/workspace/feedback", icon: ChatCircleDots },
      ],
    },
  ];
}

/** Where the work happens: the left sidebar, per interface language. */
export const navigationGroups: Record<Locale, NavGroup[]> = { tr: buildNavigationGroups("tr"), en: buildNavigationGroups("en") };

function buildAdminGroup(locale: Locale): NavGroup {
  const { groups, sections } = copy[locale];
  return { label: groups.admin, items: [{ id: "Admin", label: sections.Admin, href: "/admin", icon: ChartBar }] };
}

/** Only users in the API's ADMIN_USER_IDS see it; the API enforces the same list. */
const adminGroup: Record<Locale, NavGroup> = { tr: buildAdminGroup("tr"), en: buildAdminGroup("en") };

function buildDiscoverNavigation(locale: Locale): DiscoverItem[] {
  const { sections } = copy[locale];
  return [
    { id: "Catalog", label: sections.Catalog, href: "/workspace/catalog", icon: Compass },
    { id: "News", label: sections.News, href: "/workspace#yenilikler", icon: Megaphone },
  ];
}

/**
 * Learning and discovery: the top bar. Future informational sections
 * (guides, community) belong here, never in the sidebar.
 */
export const discoverNavigation: Record<Locale, DiscoverItem[]> = { tr: buildDiscoverNavigation("tr"), en: buildDiscoverNavigation("en") };

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
export function WorkspaceFrame({ active, admin, theme, user, initialCollapsed, children }: {
  active: WorkspaceSection | null;
  admin: boolean;
  theme: Theme;
  user: CurrentUser | null;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const pathname = usePathname();
  const tucked = useTopbarTucked();
  const topbar = useRef<HTMLElement>(null);
  const locale = useLocale();
  const t = copy[locale];
  const groups = admin ? [...navigationGroups[locale], adminGroup[locale]] : navigationGroups[locale];
  const discover = discoverNavigation[locale];

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
      <a className="skip-link" href="#workspace-content">{t.skipLink}</a>
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link className="brand" href="/workspace" onClick={() => setMobileOpen(false)}><BrandMark /></Link>
          <button aria-label={t.closeMenu} className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} type="button"><X aria-hidden size={22} /></button>
        </div>
        <nav aria-label={t.workspaceNav} className="sidebar-nav workspace-navigation">
          {groups.map((group) => (
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
            <p className="sidebar-group-label"><span>{t.groups.discover}</span></p>
            {discover.map((item) => (
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
              <span className="sidebar-label">{t.newProject}</span>
            </Link>
          )}
          {/* Phones have no room for it in the top bar; the drawer carries the language choice instead. */}
          <div className="sidebar-language"><LanguageSwitch /></div>
          <button aria-expanded={!collapsed} aria-label={collapsed ? t.expandSidebar : t.collapseSidebar} className="sidebar-toggle" onClick={toggleCollapsed} type="button">
            <span aria-hidden="true" className="sidebar-icon"><CaretDoubleLeft size={18} /></span>
            <span className="sidebar-label">{t.collapse}</span>
          </button>
        </div>
      </aside>
      <button aria-hidden="true" className="sidebar-scrim" onClick={() => setMobileOpen(false)} tabIndex={-1} type="button" />
      <div className="workspace-column">
        <header className={`topbar${tucked ? " tucked" : ""}`} ref={topbar}>
          <button aria-expanded={mobileOpen} aria-label={t.openMenu} className="icon-button topbar-menu" onClick={() => setMobileOpen(true)} type="button"><List aria-hidden size={24} /></button>
          <Link className="brand topbar-brand" href="/workspace"><BrandMark /></Link>
          <nav aria-label={t.discoverNav} className="topbar-nav">
            {discover.map((item) => (
              <Link aria-current={active === item.id ? "page" : undefined} href={item.href} key={item.id}>
                <item.icon aria-hidden size={18} weight={active === item.id ? "fill" : "regular"} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          {user && <CommandPalette variant="field" />}
          <div className="topbar-tools">
            {user && (
              <button className="button small quiet topbar-feedback" onClick={() => setFeedbackOpen(true)} title={t.feedbackHint} type="button">
                <ChatCircleDots aria-hidden size={20} /><span>{t.feedback}</span>
              </button>
            )}
            <LanguageSwitch />
            <ThemeToggle initialTheme={theme} />
            {user && (
              <details className="header-menu account-menu">
                <summary aria-label={t.accountMenu}><span className="avatar">{user.name.trim().slice(0, 1).toUpperCase() || "?"}</span></summary>
                <div className="header-menu-panel">
                  <div className="account-info"><strong>{user.name}</strong><small>{user.email}</small></div>
                  <Link href="/workspace/settings"><Gear aria-hidden size={18} />{t.accountSettings}</Link>
                  <Link href="/workspace/profiles"><Stack aria-hidden size={18} />{t.profiles}</Link>
                  {admin && <Link href="/admin"><ChartBar aria-hidden size={18} />{t.adminPanel}</Link>}
                  <LogoutButton />
                </div>
              </details>
            )}
          </div>
        </header>
        <main id="workspace-content">{children}</main>
        {feedbackOpen && (
          <DrawerFrame onClose={() => setFeedbackOpen(false)} subtitle={t.feedbackDrawerSubtitle} title={t.feedbackDrawerTitle}>
            <FeedbackForm pagePath={pathname} showHistoryLink />
          </DrawerFrame>
        )}
      </div>
    </div>
  );
}
