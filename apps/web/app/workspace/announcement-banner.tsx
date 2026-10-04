"use client";

import { ArrowRight, Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "../../components/locale-provider";
import { bannerCookie, type Announcement } from "../../lib/announcements";
import { defineCopy } from "../../lib/i18n";

const copy = defineCopy({
  tr: { label: "Duyuru", badge: "Beta", view: "İncele", whatsNew: "Neler yeni?", dismiss: "Duyuruyu kapat" },
  en: { label: "Announcement", badge: "Beta", view: "Take a look", whatsNew: "What's new?", dismiss: "Dismiss announcement" },
});

/** Slim, dismissible news strip at the top of the overview; dismissal is remembered per announcement. */
export function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  const t = copy[useLocale()];
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  function dismiss() {
    document.cookie = bannerCookie(announcement.id);
    setVisible(false);
  }
  return (
    <aside aria-label={t.label} className="announcement-banner">
      <span aria-hidden="true" className="announcement-glow" />
      <span className="announcement-badge"><Sparkle aria-hidden size={14} weight="fill" />{t.badge}</span>
      <p><strong>{announcement.title}</strong><span className="announcement-summary"> · {announcement.summary}</span></p>
      {announcement.href
        ? <Link className="announcement-link" href={announcement.href}>{t.view} <ArrowRight aria-hidden size={16} /></Link>
        : <a className="announcement-link" href="#yenilikler">{t.whatsNew} <ArrowRight aria-hidden size={16} /></a>}
      <button aria-label={t.dismiss} className="announcement-close" onClick={dismiss} type="button"><X aria-hidden size={16} /></button>
    </aside>
  );
}
