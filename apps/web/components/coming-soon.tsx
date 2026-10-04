"use client";

import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { defineCopy } from "../lib/i18n";
import { useLocale } from "./locale-provider";

const copy = defineCopy({
  tr: { badge: "Yakında · Pro", comingWithPro: "Pro ile gelecek", seePlan: "Gelişim planını gör" },
  en: { badge: "Coming soon · Pro", comingWithPro: "Coming with Pro", seePlan: "See the development plan" },
});

/** "Yakında · Pro" / "Coming soon · Pro" pill for features announced in the development plan. */
export function ComingSoonBadge({ label }: { label?: string }) {
  const t = copy[useLocale()];
  return <span className="soon-badge"><Sparkle aria-hidden size={12} weight="fill" />{label ?? t.badge}</span>;
}

/**
 * Faded placeholder for an AI feature that is not available yet. The action
 * button is permanently disabled; the plan link stays usable.
 */
export function AiComingSoon({ title, text, action }: { title: string; text: string; action: string }) {
  const t = copy[useLocale()];
  return (
    <div className="ai-soon">
      <div className="ai-soon-head">
        <span aria-hidden="true" className="mark small"><Sparkle size={18} /></span>
        <strong>{title}</strong>
        <ComingSoonBadge />
      </div>
      <p>{text}</p>
      <div className="ai-soon-foot">
        <button className="button small" disabled title={t.comingWithPro} type="button"><Sparkle aria-hidden size={16} />{action}</button>
        <Link className="text-link" href="/workspace/billing#gelisim-plani">{t.seePlan}</Link>
      </div>
    </div>
  );
}
