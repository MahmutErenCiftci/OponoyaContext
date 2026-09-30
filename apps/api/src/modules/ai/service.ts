import { createHash } from "node:crypto";
import { compileContext, stableStringify, type CompileInput, type CompileWarning as CompilerWarning } from "@devcontext/context-compiler";
import {
  aiDecisionProposalSchema,
  compileWarningSchema,
  type AcceptAiSuggestionInput,
  type AiDecisionProposal,
  type AiFailureCode,
  type AiStatus,
  type AiSuggestion,
  type AiSuggestionListQuery,
  type CompileWarning,
  type ProjectDecisionView,
  type ResourceReference,
} from "@devcontext/contracts";
import type { DecisionService } from "../decisions/service.js";
import type { ActiveStackEntry, AiProvider, DecisionProposalOutput, DecisionProposalRequest } from "./provider.js";
import { AiProviderError } from "./provider.js";
import type { AiRepository, AiSuggestionRow, CandidateRow } from "./repository.js";

/** Library Resources offered to the model; bounded so the prompt (and its cost) stays small. */
export const candidateLimit = 80;
const descriptionLimit = 280;
const rationaleLimit = 500;
const reasonLimit = 240;

export type AiServiceOptions = {
  provider: AiProvider | null;
  repository: AiRepository;
  decisions: DecisionService;
  /** Owner-scoped compiler input, used to preview the warnings a proposal would add. */
  loadCompileInput(ownerUserId: string, projectId: string): Promise<CompileInput | null>;
  /** AI suggestions per UTC calendar month allowed by the user's current plan. */
  monthlyQuota(ownerUserId: string): Promise<number>;
  now?: () => Date;
  /** Language the provider writes rationale and risks in; the product copy is Turkish. */
  language?: DecisionProposalRequest["language"];
};

export type AiSuggestionOutcome = { suggestion: AiSuggestion; reused: boolean; usage: { inputTokens: number; outputTokens: number } };

export interface AiService {
  status(ownerUserId: string): Promise<AiStatus>;
  setConsent(ownerUserId: string, consent: boolean): Promise<AiStatus>;
  requestDecisionProposal(ownerUserId: string, projectId: string, slot: string, signal?: AbortSignal): Promise<AiSuggestionOutcome>;
  list(ownerUserId: string, projectId: string, query: AiSuggestionListQuery): Promise<AiSuggestion[]>;
  accept(ownerUserId: string, suggestionId: string, input: AcceptAiSuggestionInput): Promise<{ suggestion: AiSuggestion; decision: ProjectDecisionView }>;
  reject(ownerUserId: string, suggestionId: string): Promise<AiSuggestion>;
  /** Every suggestion of the owner, oldest first (account export). */
  exportAll(ownerUserId: string): Promise<AiSuggestion[]>;
}

function aiError(statusCode: number, code: string, publicMessage: string) {
  return Object.assign(new Error(`AI request refused: ${code}`), { statusCode, details: [{ path: ["ai"], code }], publicMessage });
}

export function aiUnavailableError() {
  return aiError(409, "ai_unavailable", "AI suggestions are not enabled on this deployment.");
}

export function aiConsentRequiredError() {
  return aiError(403, "ai_consent_required", "Allow AI suggestions in Settings before asking for one.");
}

export function aiQuotaExceededError(limit: number) {
  return aiError(403, "ai_quota_exceeded", `Your plan allows ${limit} AI suggestions per month. The quota resets at the start of next month.`);
}

function notFoundError(message = "Project not found") {
  return Object.assign(new Error(message), { statusCode: 404 });
}

function slotNotDelegatedError() {
  return Object.assign(new Error("Slot is not delegated"), {
    statusCode: 409,
    details: [{ path: ["slot"], code: "slot_not_delegated" }],
    publicMessage: "AI suggestions are only available for decisions left to AI.",
  });
}

function projectArchivedError() {
  return Object.assign(new Error("Project archived"), {
    statusCode: 409,
    details: [{ path: ["project"], code: "project_archived" }],
    publicMessage: "Restore the project before asking for AI suggestions.",
  });
}

function suggestionStateError(code: "suggestion_not_pending" | "suggestion_stale" | "suggestion_without_choice", publicMessage: string) {
  return Object.assign(new Error(`Suggestion cannot be accepted: ${code}`), { statusCode: 409, details: [{ path: ["suggestion"], code }], publicMessage });
}

const providerMessages: Record<AiFailureCode, string> = {
  ai_unavailable: "The AI service is unavailable right now. Try again in a moment.",
  ai_rate_limited: "The AI service is busy. Try again in a moment.",
  ai_timeout: "The AI service took too long to answer. Try again.",
  ai_refused: "The AI service declined this request. Adjust the constraints or decide manually.",
  ai_invalid_output: "The AI answer could not be used. Try again.",
  ai_misconfigured: "AI suggestions are temporarily unavailable.",
};

/** Upstream failures answer 503 (retryable) or 409 (refused); the code is content-free. */
export function providerFailureError(error: AiProviderError) {
  return Object.assign(new Error(`AI provider failed: ${error.code}`), {
    statusCode: error.code === "ai_refused" ? 409 : 503,
    details: [{ path: ["ai"], code: error.code }],
    publicMessage: providerMessages[error.code],
    aiFailureCode: error.code,
  });
}

/** One line, no control characters, bounded; model text becomes decision rationale that is exported to coding agents. */
export function cleanText(value: string, limit: number): string {
  const single = value.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").replace(/\s+/g, " ").trim();
  return single.length > limit ? `${single.slice(0, limit - 1).trimEnd()}…` : single;
}

function startOfMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => cleanText(item, 160)).filter(Boolean).slice(0, 30) : [];
}

function constraintsOf(constraints: Record<string, unknown>): DecisionProposalRequest["constraints"] {
  const notes = typeof constraints.notes === "string" ? cleanText(constraints.notes, 1_000) : "";
  return { allowed: stringList(constraints.allowed), excluded: stringList(constraints.excluded), notes: notes || null };
}

function activeStackOf(views: ProjectDecisionView[], slot: string): ActiveStackEntry[] {
  return views
    .filter((view) => view.slot !== slot && view.effective.mode !== "AI_DECIDE")
    .slice(0, 80)
    .map((view) => ({
      slot: view.slot,
      mode: view.effective.mode as ActiveStackEntry["mode"],
      resourceName: view.effective.resource?.name ?? null,
      resourceType: view.effective.resource?.type ?? null,
    }));
}

/** Validated and bounded proposal; ids outside the candidate set make the whole answer unusable. */
export function normalizeProposal(output: DecisionProposalOutput, candidateIds: Set<string>): AiDecisionProposal {
  if (output.resourceId !== null && !candidateIds.has(output.resourceId)) throw new AiProviderError("ai_invalid_output", true);
  const seen = new Set(output.resourceId ? [output.resourceId] : []);
  const alternatives: AiDecisionProposal["alternatives"] = [];
  for (const alternative of output.alternatives) {
    if (alternatives.length === 3) break;
    if (!candidateIds.has(alternative.resourceId) || seen.has(alternative.resourceId)) continue;
    seen.add(alternative.resourceId);
    alternatives.push({ resourceId: alternative.resourceId, reason: cleanText(alternative.reason, reasonLimit) });
  }
  const proposal = {
    resourceId: output.resourceId,
    rationale: cleanText(output.rationale, rationaleLimit),
    alternatives,
    risks: output.risks.map((risk) => cleanText(risk, reasonLimit)).filter(Boolean).slice(0, 5),
    confidence: output.confidence,
  };
  const parsed = aiDecisionProposalSchema.safeParse(proposal);
  if (!parsed.success || !parsed.data.rationale) throw new AiProviderError("ai_invalid_output", true);
  return parsed.data;
}

/** Warnings the proposed choice would add to the active stack, computed with the real compiler. */
export function proposalWarnings(input: CompileInput, slot: string, resource: CandidateRow | null): CompileWarning[] {
  if (!resource) return [];
  const baseline = new Set(compileContext(input).warnings.map((warning) => `${warning.code}|${warning.slot}|${warning.resourceId}`));
  const resources = input.resources.some((item) => item.id === resource.id)
    ? input.resources
    : [...input.resources, { id: resource.id, name: resource.name, type: resource.type, description: resource.description, archivedAt: null }];
  const projectDecisions = [
    ...(input.projectDecisions ?? []).filter((decision) => decision.slot !== slot),
    { id: "00000000-0000-4000-8000-000000000000", scope: "project" as const, slot, mode: "PREFERRED" as const, resourceId: resource.id, priority: 0, constraints: {}, rationale: null },
  ];
  const simulated = compileContext({ ...input, resources, projectDecisions });
  return simulated.warnings
    .filter((warning: CompilerWarning) => !baseline.has(`${warning.code}|${warning.slot}|${warning.resourceId}`))
    .map((warning) => compileWarningSchema.parse(warning));
}

export function createAiService(options: AiServiceOptions): AiService {
  const { provider, repository, decisions } = options;
  const now = options.now ?? (() => new Date());
  const language = options.language ?? "tr";

  async function status(ownerUserId: string): Promise<AiStatus> {
    const current = now();
    const [consentAt, limit, used] = await Promise.all([
      repository.consent(ownerUserId),
      options.monthlyQuota(ownerUserId),
      repository.countSince(ownerUserId, startOfMonth(current)),
    ]);
    return {
      available: provider !== null,
      provider: provider?.id ?? null,
      model: provider?.model ?? null,
      consented: consentAt !== null,
      consentedAt: consentAt?.toISOString() ?? null,
      quota: { limit, used, remaining: Math.max(0, limit - used), resetsAt: startOfNextMonth(current).toISOString() },
    };
  }

  async function toSuggestions(ownerUserId: string, rows: AiSuggestionRow[]): Promise<AiSuggestion[]> {
    const proposals = rows.map((row) => aiDecisionProposalSchema.parse(row.proposal));
    const ids = proposals.flatMap((proposal) => [...(proposal.resourceId ? [proposal.resourceId] : []), ...proposal.alternatives.map((item) => item.resourceId)]);
    const references = new Map<string, ResourceReference>((await repository.resourceReferences(ownerUserId, ids)).map((reference) => [reference.id, reference]));
    return rows.map((row, index) => {
      const proposal = proposals[index]!;
      return {
        id: row.id,
        projectId: row.projectId,
        kind: row.kind,
        slot: row.slot,
        status: row.status,
        proposal,
        resource: proposal.resourceId ? references.get(proposal.resourceId) ?? null : null,
        alternatives: proposal.alternatives.flatMap((item) => {
          const resource = references.get(item.resourceId);
          return resource ? [{ resource, reason: item.reason }] : [];
        }),
        warnings: row.warnings.map((warning) => compileWarningSchema.parse(warning)),
        provider: row.provider,
        model: row.model,
        createdAt: row.createdAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
      };
    });
  }

  async function one(ownerUserId: string, row: AiSuggestionRow) {
    return (await toSuggestions(ownerUserId, [row]))[0]!;
  }

  async function delegatedView(ownerUserId: string, projectId: string, slot: string) {
    const views = await decisions.list(ownerUserId, projectId);
    const view = views.find((item) => item.slot === slot) ?? null;
    return { views, view: view && view.effective.mode === "AI_DECIDE" ? view : null };
  }

  return {
    status,

    async setConsent(ownerUserId, consent) {
      await repository.setConsent(ownerUserId, consent ? now() : null);
      return status(ownerUserId);
    },

    async requestDecisionProposal(ownerUserId, projectId, slot, signal) {
      if (!provider) throw aiUnavailableError();
      if (!(await repository.consent(ownerUserId))) throw aiConsentRequiredError();
      const project = await repository.project(ownerUserId, projectId);
      if (!project) throw notFoundError();
      if (project.status !== "active") throw projectArchivedError();
      const { views, view } = await delegatedView(ownerUserId, projectId, slot);
      if (!view) throw slotNotDelegatedError();

      const disabled = new Set(views.filter((item) => item.effective.mode === "DISABLED").flatMap((item) => item.effective.resource ? [item.effective.resource.id] : []));
      const candidates = (await repository.candidates(ownerUserId, candidateLimit)).filter((candidate) => !disabled.has(candidate.id));
      const request: DecisionProposalRequest = {
        slot,
        constraints: constraintsOf(view.effective.constraints),
        project: {
          name: cleanText(project.name, 160),
          description: project.description ? cleanText(project.description, 1_000) : null,
          productType: project.productType,
          stage: project.stage,
          platforms: project.platforms.slice(0, 20),
          priorities: project.priorities.slice(0, 20),
          rules: project.rules.slice(0, 30).map((rule) => cleanText(rule, 300)),
        },
        activeStack: activeStackOf(views, slot),
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          type: candidate.type,
          description: candidate.description ? cleanText(candidate.description, descriptionLimit) : null,
          tags: candidate.tags.slice(0, 8),
        })),
        language,
      };
      const inputHash = createHash("sha256").update(stableStringify({ provider: provider.id, model: provider.model, request })).digest("hex");

      // An identical pending proposal is reused: same context, same question, no second provider call.
      const existing = await repository.findPending(ownerUserId, projectId, slot, inputHash);
      if (existing) return { suggestion: await one(ownerUserId, existing), reused: true, usage: { inputTokens: 0, outputTokens: 0 } };

      const limit = await options.monthlyQuota(ownerUserId);
      if (await repository.countSince(ownerUserId, startOfMonth(now())) >= limit) throw aiQuotaExceededError(limit);

      let proposal: AiDecisionProposal;
      let result;
      try {
        result = await provider.proposeDecision(request, signal ? { signal } : undefined);
        proposal = normalizeProposal(result.output, new Set(candidates.map((candidate) => candidate.id)));
      } catch (error) {
        if (error instanceof AiProviderError) throw providerFailureError(error);
        throw error;
      }

      const chosen = proposal.resourceId ? candidates.find((candidate) => candidate.id === proposal.resourceId) ?? null : null;
      const compileInput = await options.loadCompileInput(ownerUserId, projectId);
      const warnings = compileInput ? proposalWarnings(compileInput, slot, chosen) : [];
      const row = await repository.insert({
        ownerUserId,
        projectId,
        kind: "decision_proposal",
        slot,
        provider: provider.id,
        model: result.model,
        inputHash,
        proposal,
        warnings,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        createdAt: now(),
      });
      return { suggestion: await one(ownerUserId, row), reused: false, usage: result.usage };
    },

    async list(ownerUserId, projectId, query) {
      if (!(await repository.project(ownerUserId, projectId))) throw notFoundError();
      const rows = await repository.list(ownerUserId, projectId, query.status === "all" ? null : query.status, query.limit);
      return toSuggestions(ownerUserId, rows);
    },

    async accept(ownerUserId, suggestionId, input) {
      const row = await repository.get(ownerUserId, suggestionId);
      if (!row) throw notFoundError("Suggestion not found");
      if (row.status !== "pending") throw suggestionStateError("suggestion_not_pending", "This suggestion was already handled.");
      const proposal = aiDecisionProposalSchema.parse(row.proposal);
      if (!proposal.resourceId) throw suggestionStateError("suggestion_without_choice", "This suggestion has no choice to accept.");

      const markStale = async () => {
        await repository.transition(ownerUserId, suggestionId, "pending", "stale", now());
        return suggestionStateError("suggestion_stale", "The decision changed since this suggestion was made. Ask for a new one.");
      };
      const { view } = await delegatedView(ownerUserId, row.projectId, row.slot);
      if (!view) throw await markStale();

      // Claim first so a concurrent accept/reject cannot both win; the decision write follows.
      const claimed = await repository.transition(ownerUserId, suggestionId, "pending", "accepted", now());
      if (!claimed) throw suggestionStateError("suggestion_not_pending", "This suggestion was already handled.");
      let decision: ProjectDecisionView;
      try {
        decision = await decisions.upsert(ownerUserId, row.projectId, row.slot, {
          mode: input.mode,
          resourceId: proposal.resourceId,
          priority: view.project?.priority ?? 0,
          constraints: view.effective.constraints,
          rationale: cleanText(`AI önerisi (${row.model}): ${proposal.rationale}`, rationaleLimit),
          conditions: view.project?.conditions ?? {},
        });
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : null;
        if (statusCode === 400 || statusCode === 404) {
          await repository.transition(ownerUserId, suggestionId, "accepted", "stale", now());
          throw suggestionStateError("suggestion_stale", "The proposed resource is no longer available. Ask for a new suggestion.");
        }
        await repository.transition(ownerUserId, suggestionId, "accepted", "pending", now());
        throw error;
      }
      return { suggestion: await one(ownerUserId, claimed), decision };
    },

    async reject(ownerUserId, suggestionId) {
      const row = await repository.get(ownerUserId, suggestionId);
      if (!row) throw notFoundError("Suggestion not found");
      const updated = await repository.transition(ownerUserId, suggestionId, "pending", "rejected", now());
      if (!updated) throw suggestionStateError("suggestion_not_pending", "This suggestion was already handled.");
      return one(ownerUserId, updated);
    },

    async exportAll(ownerUserId) {
      return toSuggestions(ownerUserId, await repository.listAll(ownerUserId));
    },
  };
}
