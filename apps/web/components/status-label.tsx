import { ArrowsClockwise, CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import type { ContextStatusKind } from "../lib/context-status";

const copy: Record<ContextStatusKind, string> = {
  fresh: "Güncel",
  stale: "Yenileme gerekli",
  none: "Henüz oluşturulmadı",
};

/** Context freshness with icon and text; the colour is a secondary cue. */
export function ContextStatusLabel({ kind, version, label, size = 20 }: { kind: ContextStatusKind; version?: number | null | undefined; label?: string | undefined; size?: number | undefined }) {
  const Icon = kind === "fresh" ? CheckCircle : kind === "stale" ? ArrowsClockwise : Circle;
  const tone = kind === "fresh" ? "ok" : kind === "stale" ? "warn" : "none";
  return (
    <span className={`status-label ${tone}`}>
      <Icon aria-hidden size={size} />
      {label ?? copy[kind]}
      {version ? <small>v{version}</small> : null}
    </span>
  );
}

export const contextStatusCopy = copy;
