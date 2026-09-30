import type { AiConfidence, AiFailureCode, AiProviderId, DecisionMode, ResourceType } from "@devcontext/contracts";

/**
 * AI provider boundary (V1.5 groundwork). The product rule is "AI proposes,
 * the user decides": a provider only ever returns a structured proposal that
 * the AI service validates, stores as a pending suggestion and shows for
 * review. Nothing here writes to the Library or a Project.
 *
 * Every capability is an explicit method with typed input and output, so the
 * full surface an AI can touch stays enumerable and reviewable. Providers
 * receive the minimum context the task needs (no URLs, notes, install
 * commands or secrets) and must treat every string in it as untrusted data.
 */

/** One Library Resource the AI may choose for a delegated slot. */
export type DecisionCandidate = {
  id: string;
  name: string;
  type: ResourceType;
  description: string | null;
  tags: string[];
};

/** A decision already in effect for the Project (never a delegated one). */
export type ActiveStackEntry = {
  slot: string;
  mode: Exclude<DecisionMode, "AI_DECIDE">;
  resourceName: string | null;
  resourceType: ResourceType | null;
};

export type DecisionProposalRequest = {
  slot: string;
  /** Owner-written limits from the AI_DECIDE decision; option names, not ids. */
  constraints: { allowed: string[]; excluded: string[]; notes: string | null };
  project: {
    name: string;
    description: string | null;
    productType: string | null;
    stage: string;
    platforms: string[];
    priorities: string[];
    rules: string[];
  };
  activeStack: ActiveStackEntry[];
  candidates: DecisionCandidate[];
  /** Language the rationale, reasons and risks are written in. */
  language: "tr" | "en";
};

/** Proposal as returned by a provider, before the service validates ids and bounds lengths. */
export type DecisionProposalOutput = {
  resourceId: string | null;
  rationale: string;
  alternatives: Array<{ resourceId: string; reason: string }>;
  risks: string[];
  confidence: AiConfidence;
};

export type AiUsage = { inputTokens: number; outputTokens: number };

export type AiResult<T> = {
  output: T;
  /** Model that actually served the request (a refusal fallback may differ from the configured one). */
  model: string;
  usage: AiUsage;
};

export type AiCallOptions = { signal?: AbortSignal };

export interface AiProvider {
  readonly id: AiProviderId;
  /** Configured model identifier; reported in status and stored on each suggestion. */
  readonly model: string;
  proposeDecision(request: DecisionProposalRequest, options?: AiCallOptions): Promise<AiResult<DecisionProposalOutput>>;
}

/**
 * Provider failure with a content-free code. Upstream messages are never
 * forwarded: they can echo request text back.
 */
export class AiProviderError extends Error {
  readonly code: AiFailureCode;
  readonly retryable: boolean;

  constructor(code: AiFailureCode, retryable: boolean, options?: { cause?: unknown }) {
    super(`AI provider failed: ${code}`, options);
    this.name = "AiProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
