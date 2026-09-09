/**
 * Pure, deterministic Context Compiler.
 *
 * No I/O, no framework imports. Same canonical input plus the same
 * COMPILER_VERSION always yields byte-identical `stableStringify` output.
 * Bump COMPILER_VERSION whenever ordering or semantics of the canonical object
 * change and document it in docs/09_CONTEXT_COMPILER.md.
 */
export const COMPILER_VERSION = "0.4.1";

export type DecisionMode = "LOCKED" | "PREFERRED" | "AI_DECIDE" | "DISABLED";

export type Scope = "global" | "profile" | "recipe" | "project";

export const exportTargets = ["generic", "agents", "claude", "cursor", "copilot"] as const;
export type ExportTarget = (typeof exportTargets)[number];

export type ResourceInput = {
  id: string;
  name: string;
  type: string;
  slug?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
  docsUrl?: string | null;
  repoUrl?: string | null;
  installCommand?: string | null;
  archivedAt?: string | null;
};

export type DecisionInput = {
  id: string;
  scope: Scope;
  slot: string;
  mode: DecisionMode;
  resourceId?: string | null;
  priority?: number;
  constraints?: Record<string, unknown>;
  rationale?: string | null;
  /** ISO timestamp; only used as the final tie-breaker inside one scope. */
  updatedAt?: string | null;
  /** Profile or Recipe that contributed this decision (null for global/project). */
  sourceId?: string | null;
  sourceName?: string | null;
  /** Explicit attachment priority of that Profile/Recipe on the Project; higher wins inside the scope. */
  sourcePriority?: number;
};

export type ProjectInput = {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  productType?: string | null;
  stage?: string | null;
  platforms?: string[];
  priorities?: string[];
  /** Explicit engineering rules written by the owner. */
  rules?: string[];
};

export type DecisionOrigin = { id: string; name: string; priority: number };

export type CompatibilityKind = "conflicts" | "requires";

/** Owner-curated rule between two Resources; evaluated only against the active stack. */
export type CompatibilityRuleInput = {
  id: string;
  kind: CompatibilityKind;
  leftResourceId: string;
  rightResourceId: string;
  note?: string | null;
};

export type CompileInput = {
  project: ProjectInput;
  resources: ResourceInput[];
  /** Library Resources attached to the Project directly (reference-only). */
  attachedResourceIds?: string[];
  globalDecisions?: DecisionInput[];
  profileDecisions?: DecisionInput[];
  recipeDecisions?: DecisionInput[];
  projectDecisions?: DecisionInput[];
  compatibilityRules?: CompatibilityRuleInput[];
};

export type CompiledResourceRef = {
  id: string;
  name: string;
  type: string;
  sourceUrl: string | null;
  installCommand: string | null;
  archived: boolean;
};

export type CompiledResource = CompiledResourceRef & {
  slug: string | null;
  description: string | null;
  docsUrl: string | null;
  repoUrl: string | null;
  attached: boolean;
  /** Slots where this Resource is the active (non-disabled) winner. */
  slots: string[];
};

export type ShadowedDecision = {
  decisionId: string;
  scope: Scope;
  mode: DecisionMode;
  resourceId: string | null;
  priority: number;
  origin: DecisionOrigin | null;
};

export type CompiledDecision = {
  slot: string;
  mode: DecisionMode;
  source: Scope;
  /** The Profile/Recipe behind a `profile`/`recipe` source; null for global/project. */
  origin: DecisionOrigin | null;
  decisionId: string;
  resource: CompiledResourceRef | null;
  priority: number;
  constraints: Record<string, unknown>;
  rationale: string | null;
  shadowed: ShadowedDecision[];
};

export type WarningCode =
  | "RESOURCE_UNRESOLVED"
  | "RESOURCE_ARCHIVED"
  | "RESOURCE_CONFLICT"
  | "DISABLED_RESOURCE_ATTACHED"
  | "RULE_CONFLICT"
  | "MISSING_REQUIREMENT";

export type CompileWarning = {
  code: WarningCode;
  slot: string | null;
  resourceId: string | null;
  message: string;
};

export type CanonicalContext = {
  compilerVersion: string;
  project: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    productType: string | null;
    stage: string;
    platforms: string[];
    priorities: string[];
  };
  decisions: CompiledDecision[];
  resources: CompiledResource[];
  /** Explicit engineering rules from the Project, in the owner's order. */
  rules: string[];
  warnings: CompileWarning[];
};

/** Kept for the starter API name. */
export type CompileOutput = CanonicalContext;

const scopeRank: Record<Scope, number> = { global: 0, profile: 1, recipe: 2, project: 3 };

/** Locale-independent ordering so output does not depend on the runtime ICU data. */
function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function rankDecisions(a: DecisionInput, b: DecisionInput) {
  const scope = scopeRank[b.scope] - scopeRank[a.scope];
  if (scope !== 0) return scope;
  const sourcePriority = (b.sourcePriority ?? 0) - (a.sourcePriority ?? 0);
  if (sourcePriority !== 0) return sourcePriority;
  const priority = (b.priority ?? 0) - (a.priority ?? 0);
  if (priority !== 0) return priority;
  const updated = compare(b.updatedAt ?? "", a.updatedAt ?? "");
  if (updated !== 0) return updated;
  return compare(a.id, b.id);
}

function originOf(decision: DecisionInput): DecisionOrigin | null {
  if (!decision.sourceId) return null;
  return { id: decision.sourceId, name: decision.sourceName ?? decision.sourceId, priority: decision.sourcePriority ?? 0 };
}

function toRef(resource: ResourceInput): CompiledResourceRef {
  return {
    id: resource.id,
    name: resource.name,
    type: resource.type,
    sourceUrl: resource.sourceUrl ?? null,
    installCommand: resource.installCommand ?? null,
    archived: Boolean(resource.archivedAt),
  };
}

function compareWarnings(a: CompileWarning, b: CompileWarning) {
  return compare(a.code, b.code) || compare(a.slot ?? "", b.slot ?? "") || compare(a.resourceId ?? "", b.resourceId ?? "");
}

export function compileContext(input: CompileInput): CanonicalContext {
  const resources = new Map(input.resources.map((resource) => [resource.id, resource]));
  const grouped = new Map<string, DecisionInput[]>();
  for (const decision of [
    ...(input.globalDecisions ?? []),
    ...(input.profileDecisions ?? []),
    ...(input.recipeDecisions ?? []),
    ...(input.projectDecisions ?? []),
  ]) {
    const current = grouped.get(decision.slot) ?? [];
    current.push(decision);
    grouped.set(decision.slot, current);
  }

  const decisions: CompiledDecision[] = [];
  const warnings: CompileWarning[] = [];
  const activeSlotsByResource = new Map<string, string[]>();
  const disabledSlotByResource = new Map<string, string>();

  for (const [slot, candidates] of grouped) {
    const sorted = [...candidates].sort(rankDecisions);
    const winner = sorted[0];
    if (!winner) continue;
    const resource = winner.resourceId ? resources.get(winner.resourceId) : undefined;
    if (winner.mode !== "AI_DECIDE" && !resource) {
      warnings.push({
        code: "RESOURCE_UNRESOLVED",
        slot,
        resourceId: winner.resourceId ?? null,
        message: `${slot}: the selected resource could not be found in the Library.`,
      });
    }
    if (resource?.archivedAt && winner.mode !== "DISABLED") {
      warnings.push({
        code: "RESOURCE_ARCHIVED",
        slot,
        resourceId: resource.id,
        message: `${slot}: ${resource.name} is archived in the Library. Confirm it is still wanted or pick a replacement.`,
      });
    }
    if (resource) {
      if (winner.mode === "DISABLED") disabledSlotByResource.set(resource.id, slot);
      else activeSlotsByResource.set(resource.id, [...(activeSlotsByResource.get(resource.id) ?? []), slot]);
    }
    decisions.push({
      slot,
      mode: winner.mode,
      source: winner.scope,
      origin: originOf(winner),
      decisionId: winner.id,
      resource: resource ? toRef(resource) : null,
      priority: winner.priority ?? 0,
      constraints: winner.constraints ?? {},
      rationale: winner.rationale ?? null,
      shadowed: sorted.slice(1).map((item) => ({
        decisionId: item.id,
        scope: item.scope,
        mode: item.mode,
        resourceId: item.resourceId ?? null,
        priority: item.priority ?? 0,
        origin: originOf(item),
      })),
    });
  }

  for (const [resourceId, disabledSlot] of disabledSlotByResource) {
    const activeSlots = activeSlotsByResource.get(resourceId);
    if (!activeSlots) continue;
    const name = resources.get(resourceId)?.name ?? resourceId;
    warnings.push({
      code: "RESOURCE_CONFLICT",
      slot: disabledSlot,
      resourceId,
      message: `${name} is disabled in ${disabledSlot} but selected in ${[...activeSlots].sort(compare).join(", ")}. Resolve the conflict; nothing was changed automatically.`,
    });
  }

  const attached = [...new Set(input.attachedResourceIds ?? [])].sort(compare);
  for (const resourceId of attached) {
    const resource = resources.get(resourceId);
    if (!resource) {
      warnings.push({ code: "RESOURCE_UNRESOLVED", slot: null, resourceId, message: "An attached resource could not be found in the Library." });
      continue;
    }
    if (disabledSlotByResource.has(resourceId)) {
      warnings.push({
        code: "DISABLED_RESOURCE_ATTACHED",
        slot: disabledSlotByResource.get(resourceId) ?? null,
        resourceId,
        message: `${resource.name} is attached to the project but disabled in ${disabledSlotByResource.get(resourceId)}. It is excluded from the active stack.`,
      });
    } else if (resource.archivedAt && !activeSlotsByResource.has(resourceId)) {
      warnings.push({ code: "RESOURCE_ARCHIVED", slot: null, resourceId, message: `${resource.name} is attached to the project but archived in the Library.` });
    }
  }

  const attachedSet = new Set(attached);
  const activeIds = new Set<string>([...activeSlotsByResource.keys(), ...attached.filter((id) => resources.has(id))]);
  for (const disabled of disabledSlotByResource.keys()) activeIds.delete(disabled);

  // Curated compatibility rules: evaluated against the active stack only and
  // reported as warnings. Nothing is replaced or removed on the user's behalf.
  const rules = [...(input.compatibilityRules ?? [])].sort((a, b) => compare(a.id, b.id));
  for (const rule of rules) {
    const left = resources.get(rule.leftResourceId);
    const right = resources.get(rule.rightResourceId);
    const leftName = left?.name ?? rule.leftResourceId;
    const rightName = right?.name ?? rule.rightResourceId;
    const note = rule.note?.trim() ? ` ${rule.note.trim()}` : "";
    if (!activeIds.has(rule.leftResourceId)) continue;
    if (rule.kind === "conflicts" && activeIds.has(rule.rightResourceId)) {
      warnings.push({
        code: "RULE_CONFLICT",
        slot: null,
        resourceId: rule.leftResourceId,
        message: `${leftName} conflicts with ${rightName} and both are in the active stack.${note} Resolve it manually; nothing was changed.`,
      });
    } else if (rule.kind === "requires" && !activeIds.has(rule.rightResourceId)) {
      warnings.push({
        code: "MISSING_REQUIREMENT",
        slot: null,
        resourceId: rule.leftResourceId,
        message: `${leftName} requires ${rightName}, which is not part of the active stack.${note} Add it or adjust the decision.`,
      });
    }
  }
  const compiledResources: CompiledResource[] = [...activeIds]
    .map((id) => resources.get(id)!)
    .map((resource) => ({
      ...toRef(resource),
      slug: resource.slug ?? null,
      description: resource.description ?? null,
      docsUrl: resource.docsUrl ?? null,
      repoUrl: resource.repoUrl ?? null,
      attached: attachedSet.has(resource.id),
      slots: [...(activeSlotsByResource.get(resource.id) ?? [])].sort(compare),
    }))
    .sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.id, b.id));

  decisions.sort((a, b) => compare(a.slot, b.slot));
  warnings.sort(compareWarnings);

  return {
    compilerVersion: COMPILER_VERSION,
    project: {
      id: input.project.id,
      name: input.project.name,
      slug: input.project.slug ?? null,
      description: input.project.description ?? null,
      productType: input.project.productType ?? null,
      stage: input.project.stage ?? "mvp",
      platforms: [...(input.project.platforms ?? [])],
      priorities: [...(input.project.priorities ?? [])],
    },
    decisions,
    resources: compiledResources,
    rules: [...(input.project.rules ?? [])],
    warnings,
  };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort(compare).map((key) => [key, sortKeys(record[key])]));
  }
  return value;
}

/** Deterministic JSON: recursively sorted keys, two-space indentation, LF only. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

// ---------------------------------------------------------------------------
// Export adapters. They consume only the canonical object and may change
// formatting, never decision semantics.
// ---------------------------------------------------------------------------

function modeInstruction(decision: CompiledDecision): string {
  const resource = decision.resource?.name ?? "an appropriate solution";
  switch (decision.mode) {
    case "LOCKED":
      return `Use ${resource}. Do not replace it without explicit project-owner approval.`;
    case "PREFERRED":
      return `Prefer ${resource}. Use an alternative only when it cannot satisfy the requirement, and document why.`;
    case "AI_DECIDE":
      return "This decision is delegated to you. Choose the smallest appropriate solution within the stated constraints and document the choice.";
    case "DISABLED":
      return `Do not use ${resource} in this project.`;
  }
}

function constraintLines(constraints: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const { allowed, excluded, notes, ...rest } = constraints;
  if (Array.isArray(allowed) && allowed.length > 0) lines.push(`- Allowed options: ${allowed.map(String).join(", ")}`);
  if (Array.isArray(excluded) && excluded.length > 0) lines.push(`- Excluded options: ${excluded.map(String).join(", ")}`);
  if (typeof notes === "string" && notes.trim()) lines.push(`- Constraint notes: ${notes.trim()}`);
  for (const key of Object.keys(rest).sort(compare)) {
    lines.push(`- ${key}: \`${JSON.stringify(rest[key])}\``);
  }
  return lines;
}

function sourceLabel(scope: Scope, origin: DecisionOrigin | null) {
  return origin ? `${scope} "${origin.name}"` : scope;
}

function decisionLines(decision: CompiledDecision): string[] {
  const lines = [
    `### ${decision.slot}`,
    `- Mode: ${decision.mode}`,
    `- Source: ${sourceLabel(decision.source, decision.origin)}`,
    `- Instruction: ${modeInstruction(decision)}`,
  ];
  if (decision.resource) {
    lines.push(`- Resource: ${decision.resource.name} (${decision.resource.type})`);
    if (decision.resource.sourceUrl) lines.push(`- Reference: ${decision.resource.sourceUrl}`);
    if (decision.resource.installCommand) lines.push(`- Install: \`${decision.resource.installCommand}\``);
    if (decision.resource.archived && decision.mode !== "DISABLED") lines.push("- Note: this resource is archived in the Library; confirm it is still wanted.");
  }
  if (decision.rationale) lines.push(`- Rationale: ${decision.rationale}`);
  lines.push(...constraintLines(decision.constraints));
  if (decision.shadowed.length > 0) {
    lines.push(`- Overrides: ${decision.shadowed.map((item) => `${sourceLabel(item.scope, item.origin)} ${item.mode}`).join(", ")}`);
  }
  return lines;
}

function section(title: string, decisions: CompiledDecision[], emptyText: string): string[] {
  const lines = ["", `## ${title}`];
  if (decisions.length === 0) {
    lines.push("", emptyText);
    return lines;
  }
  for (const decision of decisions) lines.push("", ...decisionLines(decision));
  return lines;
}

export function renderGenericMarkdown(context: CanonicalContext): string {
  const { project } = context;
  const lines = [
    `# Project Context — ${project.name}`,
    "",
    `Compiler ${context.compilerVersion} · generated by DevContext OS. Decisions below are the project owner's explicit choices; treat them as requirements, not suggestions.`,
    "",
    "## Project brief",
    "",
  ];
  if (project.description) lines.push(project.description, "");
  lines.push(
    `- Product type: ${project.productType ?? "not specified"}`,
    `- Stage: ${project.stage}`,
    `- Platforms: ${project.platforms.length > 0 ? project.platforms.join(", ") : "not specified"}`,
  );
  if (project.priorities.length > 0) {
    lines.push("", "### Priorities", "");
    for (const priority of project.priorities) lines.push(`- ${priority}`);
  }
  lines.push(
    "",
    "## How to read the decisions",
    "",
    "- LOCKED: must use; never replace without explicit owner approval.",
    "- PREFERRED: use by default; alternatives only with a documented reason.",
    "- AI_DECIDE: deliberately delegated to you within the listed constraints.",
    "- DISABLED: never use in this project.",
  );
  lines.push(...section("Locked decisions", context.decisions.filter((d) => d.mode === "LOCKED"), "_No locked decisions._"));
  lines.push(...section("Preferred defaults", context.decisions.filter((d) => d.mode === "PREFERRED"), "_No preferred defaults._"));
  lines.push(...section("Delegated decisions (AI decides)", context.decisions.filter((d) => d.mode === "AI_DECIDE"), "_Nothing is delegated; ask before choosing new technologies._"));
  lines.push(...section("Do not use", context.decisions.filter((d) => d.mode === "DISABLED"), "_No disabled technologies._"));

  lines.push("", "## Reference resources", "");
  if (context.resources.length === 0) {
    lines.push("_No saved resources are attached or referenced._");
  }
  for (const resource of context.resources) {
    const tags = [resource.attached ? "attached to project" : null, resource.slots.length > 0 ? `slots: ${resource.slots.join(", ")}` : null].filter(Boolean);
    lines.push(`- **${resource.name}** (${resource.type})${tags.length > 0 ? ` · ${tags.join(" · ")}` : ""}`);
    if (resource.description) lines.push(`  - ${resource.description}`);
    if (resource.sourceUrl) lines.push(`  - Source: ${resource.sourceUrl}`);
    if (resource.docsUrl) lines.push(`  - Docs: ${resource.docsUrl}`);
    if (resource.repoUrl) lines.push(`  - Repository: ${resource.repoUrl}`);
    if (resource.installCommand) lines.push(`  - Install: \`${resource.installCommand}\``);
    if (resource.archived) lines.push("  - Note: archived in the Library; confirm before relying on it.");
  }

  if (context.rules.length > 0) {
    lines.push("", "## Engineering rules", "");
    for (const rule of context.rules) lines.push(`- ${rule}`);
  }

  if (context.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of context.warnings) lines.push(`- ${warning.code}: ${warning.message}`);
  }

  lines.push(
    "",
    "## Working rules",
    "",
    "- Do not introduce a replacement for a locked technology.",
    "- Check preferred and attached resources before implementing custom alternatives.",
    "- Treat AI_DECIDE slots as delegated decisions, not missing requirements; record what you chose and why.",
    "- Never use disabled technologies, even as transitive conveniences.",
    "- Keep implementation proportional to the current project stage.",
    "",
  );
  return lines.join("\n");
}

export function renderAgentsMd(context: CanonicalContext): string {
  return [
    `# AGENTS.md — ${context.project.name}`,
    "",
    "Repository instructions for coding agents. Follow the project context below for all implementation work.",
    "",
    renderGenericMarkdown(context),
  ].join("\n");
}

export function renderClaudeMd(context: CanonicalContext): string {
  return [
    `# CLAUDE.md — ${context.project.name}`,
    "",
    "Use these project decisions as persistent implementation context.",
    "If a decision conflicts with a user instruction in the current task, surface the conflict before changing architecture.",
    "",
    renderGenericMarkdown(context),
  ].join("\n");
}

export function renderCursorRule(context: CanonicalContext): string {
  return [
    "---",
    `description: "DevContext project rules for ${context.project.name.replace(/"/g, "'")}"`,
    "alwaysApply: true",
    "---",
    "",
    renderGenericMarkdown(context),
  ].join("\n");
}

export function renderCopilotInstructions(context: CanonicalContext): string {
  return [
    `# Copilot instructions — ${context.project.name}`,
    "",
    "Use these repository-wide project constraints for code generation and review.",
    "",
    renderGenericMarkdown(context),
  ].join("\n");
}

export type RenderedExport = { target: ExportTarget; fileName: string; content: string };

export const exportFileNames: Record<ExportTarget, string> = {
  generic: "PROJECT_CONTEXT.md",
  agents: "AGENTS.md",
  claude: "CLAUDE.md",
  cursor: ".cursor/rules/devcontext.mdc",
  copilot: ".github/copilot-instructions.md",
};

export function renderExport(target: ExportTarget, context: CanonicalContext): RenderedExport {
  const renderers: Record<ExportTarget, (input: CanonicalContext) => string> = {
    generic: renderGenericMarkdown,
    agents: renderAgentsMd,
    claude: renderClaudeMd,
    cursor: renderCursorRule,
    copilot: renderCopilotInstructions,
  };
  return { target, fileName: exportFileNames[target], content: renderers[target](context) };
}
