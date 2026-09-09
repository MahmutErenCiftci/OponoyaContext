import type { ContextState } from "@devcontext/contracts";

export type ContextStatusKind = "fresh" | "stale" | "none";

export type ContextStatus = { kind: ContextStatusKind; version: number | null; createdAt: string | null; warnings: number };

/** Freshness of a project's compiled context from the API's context state; null (not loadable) reads as "none". */
export function contextStatus(state: ContextState | null): ContextStatus {
  if (!state?.version) return { kind: "none", version: null, createdAt: null, warnings: state?.draftWarnings.length ?? 0 };
  return {
    kind: state.stale ? "stale" : "fresh",
    version: state.version.version,
    createdAt: state.version.createdAt,
    warnings: state.version.warningCount,
  };
}
