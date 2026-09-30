import {
  compileContext,
  exportFileNames,
  exportTargets,
  renderExport,
  stableStringify,
  type CompileInput,
} from "@devcontext/context-compiler";
import { diffContexts } from "@devcontext/context-compiler/diff";
import { hashCanonical } from "@devcontext/context-compiler/hash";
import { createZip } from "../../lib/zip.js";
import {
  canonicalContextSchema,
  exportEventTargetSchema,
  type CompileWarning,
  type ContextDiff,
  type ContextState,
  type ContextVersion,
  type ContextVersionSummary,
  type CreateExportInput,
  type ExportEvent,
  type ProjectContextStatus,
} from "@devcontext/contracts";

export type ContextVersionRow = {
  id: string;
  version: number;
  compilerVersion: string;
  contentHash: string;
  canonical: Record<string, unknown>;
  createdAt: Date;
};

export type ExportEventRow = {
  id: string;
  target: string;
  metadata: Record<string, unknown>;
  contextVersion: number | null;
  contentHash: string | null;
  createdAt: Date;
};

/** Latest stored version of a Project without its canonical JSON. */
export type LatestVersionSummary = { projectId: string; version: number; contentHash: string; createdAt: Date; warningCount: number };

export interface ContextRepository {
  projectExists(ownerUserId: string, projectId: string): Promise<boolean>;
  /** Every owner-scoped input the compiler needs, or `null` when the Project is not the owner's. */
  loadCompileInput(ownerUserId: string, projectId: string): Promise<CompileInput | null>;
  /** The same inputs for many Projects with one set of queries; foreign or missing ids are absent. */
  loadCompileInputs(ownerUserId: string, projectIds: string[]): Promise<Map<string, CompileInput>>;
  latestSummaries(ownerUserId: string, projectIds: string[]): Promise<Map<string, LatestVersionSummary>>;
  latestVersion(ownerUserId: string, projectId: string): Promise<ContextVersionRow | null>;
  listVersions(ownerUserId: string, projectId: string, limit: number): Promise<ContextVersionRow[]>;
  findVersion(ownerUserId: string, projectId: string, version: number): Promise<ContextVersionRow | null>;
  /**
   * Stores a new monotonic version unless the latest version already has the
   * same content hash. Must serialize concurrent calls for one Project.
   */
  createVersionIfChanged(
    ownerUserId: string,
    projectId: string,
    canonical: Record<string, unknown>,
    contentHash: string,
    compilerVersion: string,
  ): Promise<{ row: ContextVersionRow; created: boolean } | null>;
  /** Records an export; a repeated `idempotencyKey` returns the original event. */
  recordExport(
    ownerUserId: string,
    projectId: string,
    contextVersionId: string,
    target: string,
    fileName: string,
    idempotencyKey: string | null,
  ): Promise<{ row: ExportEventRow; created: boolean } | null>;
  listExports(ownerUserId: string, projectId: string, limit: number): Promise<ExportEventRow[]>;
}

function notFoundError(message = "Project not found") {
  return Object.assign(new Error(message), { statusCode: 404 });
}

/** Exports need a stored version; the client should compile first. */
export function notCompiledError() {
  return Object.assign(new Error("Project has not been compiled"), {
    statusCode: 409,
    details: [{ path: ["version"], code: "context_not_compiled" }],
  });
}

export function toContextVersion(row: ContextVersionRow): ContextVersion {
  const canonical = canonicalContextSchema.parse(row.canonical);
  return {
    id: row.id,
    version: row.version,
    compilerVersion: row.compilerVersion,
    contentHash: row.contentHash,
    decisionCount: canonical.decisions.length,
    warningCount: canonical.warnings.length,
    createdAt: row.createdAt.toISOString(),
    canonical,
    previews: exportTargets.map((target) => renderExport(target, canonical)),
  };
}

/** Summary for lists: counts read straight from the stored canonical, which this API wrote and validated. */
export function toVersionSummary(row: ContextVersionRow): ContextVersionSummary {
  const count = (key: "decisions" | "warnings") => {
    const value = row.canonical[key];
    return Array.isArray(value) ? value.length : 0;
  };
  return {
    id: row.id,
    version: row.version,
    compilerVersion: row.compilerVersion,
    contentHash: row.contentHash,
    decisionCount: count("decisions"),
    warningCount: count("warnings"),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toExportEvent(row: ExportEventRow): ExportEvent {
  const target = exportEventTargetSchema.parse(row.target);
  const fileName = typeof row.metadata.fileName === "string" ? row.metadata.fileName : target === "bundle" ? "devcontext-context.zip" : exportFileNames[target];
  return {
    id: row.id,
    target,
    fileName,
    contextVersion: row.contextVersion,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ContextService {
  compile(ownerUserId: string, projectId: string): Promise<{ version: ContextVersion; created: boolean }>;
  current(ownerUserId: string, projectId: string): Promise<ContextState>;
  /** Freshness of many Projects at once for lists: one compile each, no canonical parsing or previews. */
  statuses(ownerUserId: string, projectIds: string[]): Promise<ProjectContextStatus[]>;
  /** Newest first, at most `limit` (the plan's visible history) and never more than the stored maximum. */
  listVersions(ownerUserId: string, projectId: string, limit?: number): Promise<ContextVersionSummary[]>;
  getVersion(ownerUserId: string, projectId: string, version: number): Promise<ContextVersion>;
  export(ownerUserId: string, projectId: string, input: CreateExportInput, idempotencyKey?: string): Promise<{
    export: ContextVersion["previews"][number] & { contextVersion: number; contentHash: string };
    event: ExportEvent;
    created: boolean;
  }>;
  listExports(ownerUserId: string, projectId: string): Promise<ExportEvent[]>;
  /**
   * Every export target plus the canonical JSON and a manifest in one
   * deterministic zip (stable paths, pinned timestamps). Records an export
   * event with target `bundle`.
   */
  bundle(ownerUserId: string, projectId: string, version?: number, idempotencyKey?: string): Promise<ContextBundle>;
  /** Semantic diff between two stored versions; defaults to the latest and the one before it. */
  diff(ownerUserId: string, projectId: string, range: { from?: number | undefined; to?: number | undefined }): Promise<{
    from: ContextVersionSummary | null;
    to: ContextVersionSummary | null;
    diff: ContextDiff | null;
  }>;
}

const historyLimit = 50;

export type ContextBundle = {
  fileName: string;
  content: Buffer;
  contextVersion: number;
  contentHash: string;
  event: ExportEvent;
  created: boolean;
};

export const bundleManifestFileName = "devcontext-bundle.json";
export const bundleCanonicalFileName = "devcontext-context.json";

function bundleBaseName(slug: string | null, fallback: string) {
  const base = (slug ?? fallback).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return base || "project";
}

export function buildBundle(version: ContextVersion): { fileName: string; content: Buffer } {
  const { canonical } = version;
  const files = version.previews.map((preview) => ({ path: preview.fileName, content: preview.content }));
  const manifest = {
    format: "devcontext-bundle",
    version: 1,
    project: { id: canonical.project.id, name: canonical.project.name, slug: canonical.project.slug },
    contextVersion: version.version,
    compilerVersion: version.compilerVersion,
    contentHash: version.contentHash,
    files: [...files.map((file) => file.path), bundleCanonicalFileName].sort(),
  };
  const content = createZip([
    ...files,
    { path: bundleCanonicalFileName, content: `${stableStringify(canonical)}\n` },
    { path: bundleManifestFileName, content: `${JSON.stringify(manifest, null, 2)}\n` },
  ]);
  return { fileName: `${bundleBaseName(canonical.project.slug, canonical.project.name)}-context-v${version.version}.zip`, content };
}

export function createContextService(repository: ContextRepository): ContextService {
  async function ensureProject(ownerUserId: string, projectId: string) {
    if (!(await repository.projectExists(ownerUserId, projectId))) throw notFoundError();
  }

  function compileDraft(input: CompileInput) {
    const canonical = compileContext(input);
    return { canonical, hash: hashCanonical(canonical), warnings: canonical.warnings as CompileWarning[] };
  }

  return {
    async compile(ownerUserId, projectId) {
      const input = await repository.loadCompileInput(ownerUserId, projectId);
      if (!input) throw notFoundError();
      const draft = compileDraft(input);
      const result = await repository.createVersionIfChanged(
        ownerUserId,
        projectId,
        draft.canonical as unknown as Record<string, unknown>,
        draft.hash,
        draft.canonical.compilerVersion,
      );
      if (!result) throw notFoundError();
      return { version: toContextVersion(result.row), created: result.created };
    },
    async current(ownerUserId, projectId) {
      const input = await repository.loadCompileInput(ownerUserId, projectId);
      if (!input) throw notFoundError();
      const draft = compileDraft(input);
      const latest = await repository.latestVersion(ownerUserId, projectId);
      return {
        version: latest ? toContextVersion(latest) : null,
        stale: !latest || latest.contentHash !== draft.hash,
        draftHash: draft.hash,
        draftWarnings: draft.warnings,
      };
    },
    async statuses(ownerUserId, projectIds) {
      const [inputs, latest] = await Promise.all([
        repository.loadCompileInputs(ownerUserId, projectIds),
        repository.latestSummaries(ownerUserId, projectIds),
      ]);
      return [...inputs.entries()].map(([projectId, input]) => {
        const draft = compileDraft(input);
        const stored = latest.get(projectId) ?? null;
        return {
          projectId,
          stale: !stored || stored.contentHash !== draft.hash,
          draftWarningCount: draft.warnings.length,
          latest: stored ? { version: stored.version, createdAt: stored.createdAt.toISOString(), warningCount: stored.warningCount } : null,
        };
      });
    },
    async listVersions(ownerUserId, projectId, limit = historyLimit) {
      await ensureProject(ownerUserId, projectId);
      return (await repository.listVersions(ownerUserId, projectId, Math.min(limit, historyLimit))).map(toVersionSummary);
    },
    async getVersion(ownerUserId, projectId, version) {
      await ensureProject(ownerUserId, projectId);
      const row = await repository.findVersion(ownerUserId, projectId, version);
      if (!row) throw notFoundError("Context version not found");
      return toContextVersion(row);
    },
    async export(ownerUserId, projectId, input, idempotencyKey) {
      await ensureProject(ownerUserId, projectId);
      const row = input.version === undefined
        ? await repository.latestVersion(ownerUserId, projectId)
        : await repository.findVersion(ownerUserId, projectId, input.version);
      if (!row) {
        if (input.version === undefined) throw notCompiledError();
        throw notFoundError("Context version not found");
      }
      // Only the requested target is rendered; the other four previews are not needed to record an export.
      const preview = renderExport(input.target, canonicalContextSchema.parse(row.canonical));
      const recorded = await repository.recordExport(ownerUserId, projectId, row.id, input.target, preview.fileName, idempotencyKey ?? null);
      if (!recorded) throw notFoundError();
      return {
        export: { ...preview, contextVersion: row.version, contentHash: row.contentHash },
        event: toExportEvent(recorded.row),
        created: recorded.created,
      };
    },
    async listExports(ownerUserId, projectId) {
      await ensureProject(ownerUserId, projectId);
      return (await repository.listExports(ownerUserId, projectId, historyLimit)).map(toExportEvent);
    },
    async bundle(ownerUserId, projectId, versionNumber, idempotencyKey) {
      await ensureProject(ownerUserId, projectId);
      const row = versionNumber === undefined
        ? await repository.latestVersion(ownerUserId, projectId)
        : await repository.findVersion(ownerUserId, projectId, versionNumber);
      if (!row) {
        if (versionNumber === undefined) throw notCompiledError();
        throw notFoundError("Context version not found");
      }
      const version = toContextVersion(row);
      const bundle = buildBundle(version);
      const recorded = await repository.recordExport(ownerUserId, projectId, row.id, "bundle", bundle.fileName, idempotencyKey ?? null);
      if (!recorded) throw notFoundError();
      return { ...bundle, contextVersion: row.version, contentHash: row.contentHash, event: toExportEvent(recorded.row), created: recorded.created };
    },
    async diff(ownerUserId, projectId, range) {
      await ensureProject(ownerUserId, projectId);
      const toRow = range.to === undefined
        ? await repository.latestVersion(ownerUserId, projectId)
        : await repository.findVersion(ownerUserId, projectId, range.to);
      if (!toRow) {
        if (range.to !== undefined) throw notFoundError("Context version not found");
        return { from: null, to: null, diff: null };
      }
      const fromNumber = range.from ?? toRow.version - 1;
      const fromRow = fromNumber >= 1 ? await repository.findVersion(ownerUserId, projectId, fromNumber) : null;
      if (!fromRow) {
        if (range.from !== undefined) throw notFoundError("Context version not found");
        return { from: null, to: toVersionSummary(toRow), diff: null };
      }
      const before = canonicalContextSchema.parse(fromRow.canonical);
      const after = canonicalContextSchema.parse(toRow.canonical);
      return {
        from: toVersionSummary(fromRow),
        to: toVersionSummary(toRow),
        diff: diffContexts(before, after) as ContextDiff,
      };
    },
  };
}
