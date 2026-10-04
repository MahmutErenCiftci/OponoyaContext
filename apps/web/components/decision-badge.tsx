"use client";

import type { DecisionMode } from "@devcontext/contracts";
import { CircleDashed, LockSimple, MinusCircle, Star } from "@phosphor-icons/react/dist/ssr";
import { modeLabels } from "../lib/decision-slots";
import { defineCopy } from "../lib/i18n";
import { useLocale } from "./locale-provider";

const copy = defineCopy({
  tr: { noRule: "Kural yok" },
  en: { noRule: "No rule" },
});

/** Icon for a decision mode; colour is never the only signal, the label always accompanies it. */
export function ModeIcon({ mode, size = 18 }: { mode: DecisionMode; size?: number }) {
  if (mode === "LOCKED") return <LockSimple aria-hidden size={size} />;
  if (mode === "PREFERRED") return <Star aria-hidden size={size} />;
  if (mode === "DISABLED") return <MinusCircle aria-hidden size={size} />;
  return <CircleDashed aria-hidden size={size} />;
}

/** Client component so server pages (project overview) and client screens share one localized badge. */
export function DecisionBadge({ mode, boxed = false, label, size = 18 }: { mode: DecisionMode; boxed?: boolean; label?: string; size?: number }) {
  const locale = useLocale();
  return (
    <span className={`badge badge-${mode.toLowerCase()}${boxed ? " boxed" : ""}`}>
      <ModeIcon mode={mode} size={size} />
      {label ?? modeLabels[locale][mode]}
    </span>
  );
}

export function NoRuleBadge({ label, boxed = false }: { label?: string; boxed?: boolean }) {
  const locale = useLocale();
  return <span className={`badge badge-none${boxed ? " boxed" : ""}`}>{label ?? copy[locale].noRule}</span>;
}
