import type { ContextState, ProjectContextStatus } from "@devcontext/contracts";

export type ContextStatusKind = "fresh" | "stale" | "none";

export type ContextStatus = { kind: ContextStatusKind; version: number | null; createdAt: string | null; warnings: number };

const unknown: ContextStatus = { kind: "none", version: null, createdAt: null, warnings: 0 };

/** Freshness of a project's compiled context from the API's full context state; null (not loadable) reads as "none". */
export function contextStatus(state: ContextState | null): ContextStatus {
  if (!state?.version) return { ...unknown, warnings: state?.draftWarnings.length ?? 0 };
  return {
    kind: state.stale ? "stale" : "fresh",
    version: state.version.version,
    createdAt: state.version.createdAt,
    warnings: state.version.warningCount,
  };
}

/** The same freshness from the light batch status used by lists and dashboards. */
export function contextStatusFrom(status: ProjectContextStatus | null | undefined): ContextStatus {
  if (!status) return unknown;
  if (!status.latest) return { ...unknown, warnings: status.draftWarningCount };
  return {
    kind: status.stale ? "stale" : "fresh",
    version: status.latest.version,
    createdAt: status.latest.createdAt,
    warnings: status.latest.warningCount,
  };
}
