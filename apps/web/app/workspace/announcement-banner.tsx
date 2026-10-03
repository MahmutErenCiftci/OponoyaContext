"use client";

import { ArrowRight, Sparkle, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useState } from "react";
import { bannerCookie, type Announcement } from "../../lib/announcements";

/** Slim, dismissible news strip at the top of the overview; dismissal is remembered per announcement. */
export function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  function dismiss() {
    document.cookie = bannerCookie(announcement.id);
    setVisible(false);
  }
  return (
    <aside aria-label="Duyuru" className="announcement-banner">
      <span aria-hidden="true" className="announcement-glow" />
      <span className="announcement-badge"><Sparkle aria-hidden size={14} weight="fill" />Beta</span>
      <p><strong>{announcement.title}</strong><span className="announcement-summary"> · {announcement.summary}</span></p>
      {announcement.href
        ? <Link className="announcement-link" href={announcement.href}>İncele <ArrowRight aria-hidden size={16} /></Link>
        : <a className="announcement-link" href="#yenilikler">Neler yeni? <ArrowRight aria-hidden size={16} /></a>}
      <button aria-label="Duyuruyu kapat" className="announcement-close" onClick={dismiss} type="button"><X aria-hidden size={16} /></button>
    </aside>
  );
}
