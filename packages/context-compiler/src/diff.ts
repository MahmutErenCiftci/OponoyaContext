import { stableStringify, type CanonicalContext, type CompiledDecision, type CompiledResource, type CompileWarning } from "./index.js";

export type DecisionField = "mode" | "resource" | "source" | "constraints" | "rationale";

export type DecisionChange = {
  slot: string;
  kind: "added" | "removed" | "changed";
  fields: DecisionField[];
  before: CompiledDecision | null;
  after: CompiledDecision | null;
};

export type ProjectFieldChange = {
  field: "name" | "description" | "productType" | "stage" | "platforms" | "priorities";
  before: string | null;
  after: string | null;
};

export type ContextDiff = {
  compilerVersion: { before: string; after: string } | null;
  project: ProjectFieldChange[];
  decisions: DecisionChange[];
  resources: { added: CompiledResource[]; removed: CompiledResource[] };
  rules: { added: string[]; removed: string[] };
  warnings: { added: CompileWarning[]; removed: CompileWarning[] };
  unchanged: boolean;
};

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sourceKey(decision: CompiledDecision) {
  return `${decision.source}:${decision.origin?.id ?? ""}`;
}

function warningKey(warning: CompileWarning) {
  return `${warning.code}|${warning.slot ?? ""}|${warning.resourceId ?? ""}`;
}

function projectValue(value: string | string[] | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? value.join(", ") : value;
}

/**
 * Semantic difference between two canonical contexts: which slots were added,
 * removed or changed (and in what way), which resources, rules and warnings came
 * or went, and which brief fields moved. Deterministic and pure.
 */
export function diffContexts(before: CanonicalContext, after: CanonicalContext): ContextDiff {
  const decisions: DecisionChange[] = [];
  const beforeBySlot = new Map(before.decisions.map((decision) => [decision.slot, decision]));
  const afterBySlot = new Map(after.decisions.map((decision) => [decision.slot, decision]));
  for (const slot of [...new Set([...beforeBySlot.keys(), ...afterBySlot.keys()])].sort(compare)) {
    const previous = beforeBySlot.get(slot) ?? null;
    const next = afterBySlot.get(slot) ?? null;
    if (previous && !next) decisions.push({ slot, kind: "removed", fields: [], before: previous, after: null });
    else if (!previous && next) decisions.push({ slot, kind: "added", fields: [], before: null, after: next });
    else if (previous && next) {
      const fields: DecisionField[] = [];
      if (previous.mode !== next.mode) fields.push("mode");
      if ((previous.resource?.id ?? null) !== (next.resource?.id ?? null)) fields.push("resource");
      if (sourceKey(previous) !== sourceKey(next)) fields.push("source");
      if (stableStringify(previous.constraints) !== stableStringify(next.constraints)) fields.push("constraints");
      if ((previous.rationale ?? null) !== (next.rationale ?? null)) fields.push("rationale");
      if (fields.length > 0) decisions.push({ slot, kind: "changed", fields, before: previous, after: next });
    }
  }

  const beforeResources = new Map(before.resources.map((resource) => [resource.id, resource]));
  const afterResources = new Map(after.resources.map((resource) => [resource.id, resource]));
  const resources = {
    added: after.resources.filter((resource) => !beforeResources.has(resource.id)),
    removed: before.resources.filter((resource) => !afterResources.has(resource.id)),
  };

  const rules = {
    added: after.rules.filter((rule) => !before.rules.includes(rule)),
    removed: before.rules.filter((rule) => !after.rules.includes(rule)),
  };

  const beforeWarnings = new Set(before.warnings.map(warningKey));
  const afterWarnings = new Set(after.warnings.map(warningKey));
  const warnings = {
    added: after.warnings.filter((warning) => !beforeWarnings.has(warningKey(warning))),
    removed: before.warnings.filter((warning) => !afterWarnings.has(warningKey(warning))),
  };

  const project: ProjectFieldChange[] = [];
  for (const field of ["name", "description", "productType", "stage", "platforms", "priorities"] as const) {
    const previous = projectValue(before.project[field]);
    const next = projectValue(after.project[field]);
    if (previous !== next) project.push({ field, before: previous, after: next });
  }

  const compilerVersion = before.compilerVersion === after.compilerVersion ? null : { before: before.compilerVersion, after: after.compilerVersion };
  const unchanged = compilerVersion === null && project.length === 0 && decisions.length === 0
    && resources.added.length === 0 && resources.removed.length === 0
    && rules.added.length === 0 && rules.removed.length === 0
    && warnings.added.length === 0 && warnings.removed.length === 0;

  return { compilerVersion, project, decisions, resources, rules, warnings, unchanged };
}
