import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { AiEffort } from "@devcontext/contracts";
import { decisionProposalSystemPrompt, decisionProposalWireSchema, renderDecisionProposalInput } from "./prompts.js";
import { AiProviderError, type AiProvider, type AiResult, type DecisionProposalOutput } from "./provider.js";

export type AnthropicProviderOptions = {
  /** Server-only key from `AI_API_KEY`; never logged, never sent to the browser. */
  apiKey: string;
  model: string;
  /** Output effort; unset keeps the model default. */
  effort: AiEffort | null;
  timeoutMs: number;
  maxOutputTokens: number;
  /** SDK retries on 408/409/429/5xx and connection errors. */
  maxRetries?: number;
  /** Test hook: a fetch implementation that never reaches the network. */
  fetch?: typeof fetch;
};

/** Server-side refusal fallback ("default" routes by refusal category) on the models documented to accept it. */
export function supportsServerFallback(model: string) {
  return /^claude-(opus-5|fable-5)/.test(model);
}

const fallbackBeta = "server-side-fallback-2026-07-01";

/** Maps SDK errors to content-free failure codes; upstream messages are never forwarded. */
export function mapAnthropicError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AiProviderError("ai_timeout", true, { cause: error });
  if (error instanceof Anthropic.APIUserAbortError) return new AiProviderError("ai_timeout", true, { cause: error });
  if (error instanceof Anthropic.APIConnectionError) return new AiProviderError("ai_unavailable", true, { cause: error });
  if (error instanceof Anthropic.RateLimitError) return new AiProviderError("ai_rate_limited", true, { cause: error });
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError || error instanceof Anthropic.NotFoundError) {
    return new AiProviderError("ai_misconfigured", false, { cause: error });
  }
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.UnprocessableEntityError) {
    return new AiProviderError("ai_misconfigured", false, { cause: error });
  }
  if (error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIError) return new AiProviderError("ai_unavailable", true, { cause: error });
  return new AiProviderError("ai_unavailable", true, { cause: error });
}

/**
 * Claude through the official SDK. Structured outputs constrain the answer to
 * `decisionProposalWireSchema`; the response is still parsed and validated
 * here, and a refusal or truncated answer becomes a typed failure instead of
 * a guess.
 */
export function createAnthropicProvider(options: AnthropicProviderOptions): AiProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries ?? 1,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const fallback = supportsServerFallback(options.model);

  return {
    id: "anthropic",
    model: options.model,
    async proposeDecision(request, callOptions): Promise<AiResult<DecisionProposalOutput>> {
      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await client.beta.messages.create({
          model: options.model,
          max_tokens: options.maxOutputTokens,
          system: decisionProposalSystemPrompt,
          messages: [{ role: "user", content: renderDecisionProposalInput(request) }],
          output_config: {
            format: betaZodOutputFormat(decisionProposalWireSchema),
            ...(options.effort ? { effort: options.effort } : {}),
          },
          ...(fallback ? { betas: [fallbackBeta], fallbacks: "default" as const } : {}),
        }, callOptions?.signal ? { signal: callOptions.signal } : undefined);
      } catch (error) {
        throw mapAnthropicError(error);
      }
      if (message.stop_reason === "refusal") throw new AiProviderError("ai_refused", false);
      if (message.stop_reason === "max_tokens" || message.stop_reason === "model_context_window_exceeded") {
        throw new AiProviderError("ai_invalid_output", true);
      }
      const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new AiProviderError("ai_invalid_output", true, { cause: error });
      }
      const output = decisionProposalWireSchema.safeParse(parsed);
      if (!output.success) throw new AiProviderError("ai_invalid_output", true);
      return {
        output: output.data,
        model: message.model,
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      };
    },
  };
}
