"use client";

import { ArrowsClockwise, CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import type { ContextStatusKind } from "../lib/context-status";
import { defineCopy } from "../lib/i18n";
import { useLocale } from "./locale-provider";

const copy = defineCopy<Record<ContextStatusKind, string>>({
  tr: {
    fresh: "Güncel",
    stale: "Yenileme gerekli",
    none: "Henüz oluşturulmadı",
  },
  en: {
    fresh: "Up to date",
    stale: "Needs refresh",
    none: "Not created yet",
  },
});

/** Context freshness with icon and text; the colour is a secondary cue. Client component so server pages can use the localized default text. */
export function ContextStatusLabel({ kind, version, label, size = 20 }: { kind: ContextStatusKind; version?: number | null | undefined; label?: string | undefined; size?: number | undefined }) {
  const locale = useLocale();
  const Icon = kind === "fresh" ? CheckCircle : kind === "stale" ? ArrowsClockwise : Circle;
  const tone = kind === "fresh" ? "ok" : kind === "stale" ? "warn" : "none";
  return (
    <span className={`status-label ${tone}`}>
      <Icon aria-hidden size={size} />
      {label ?? copy[locale][kind]}
      {version ? <small>v{version}</small> : null}
    </span>
  );
}

/** Default status text per language: `contextStatusCopy[locale][kind]`. */
export const contextStatusCopy = copy;
