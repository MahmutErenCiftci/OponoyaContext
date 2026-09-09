import type { DecisionMode } from "@devcontext/contracts";
import { CircleDashed, LockSimple, MinusCircle, Star } from "@phosphor-icons/react/dist/ssr";
import { modeLabels } from "../lib/decision-slots";

/** Icon for a decision mode; colour is never the only signal, the label always accompanies it. */
export function ModeIcon({ mode, size = 18 }: { mode: DecisionMode; size?: number }) {
  if (mode === "LOCKED") return <LockSimple aria-hidden size={size} />;
  if (mode === "PREFERRED") return <Star aria-hidden size={size} />;
  if (mode === "DISABLED") return <MinusCircle aria-hidden size={size} />;
  return <CircleDashed aria-hidden size={size} />;
}

export function DecisionBadge({ mode, boxed = false, label, size = 18 }: { mode: DecisionMode; boxed?: boolean; label?: string; size?: number }) {
  return (
    <span className={`badge badge-${mode.toLowerCase()}${boxed ? " boxed" : ""}`}>
      <ModeIcon mode={mode} size={size} />
      {label ?? modeLabels[mode]}
    </span>
  );
}

export function NoRuleBadge({ label = "Kural yok", boxed = false }: { label?: string; boxed?: boolean }) {
  return <span className={`badge badge-none${boxed ? " boxed" : ""}`}>{label}</span>;
}
