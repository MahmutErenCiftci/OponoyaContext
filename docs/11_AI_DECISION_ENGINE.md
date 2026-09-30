# 11 — AI Decision Engine (V1.5+)

## Product rule

AI **proposes** technical decisions. It does not silently own the user's architecture.

## AI Decide contract

When a slot is delegated, compiler should emit:

- slot
- allowed options if any
- excluded options
- project constraints
- priority order
- relevant active stack
- required rationale format

Example:

```json
{
  "slot": "backend.framework",
  "mode": "AI_DECIDE",
  "constraints": {
    "language": "go",
    "allowed": ["chi", "fiber", "gin"],
    "avoid": ["echo"],
    "priorities": ["simplicity", "maintainability", "performance"]
  }
}
```

## Product-side AI recommendation flow

1. User requests recommendation.
2. Build minimal relevant context.
3. AI returns structured proposal.
4. Validate output against schema.
5. Run compatibility rules.
6. Show proposal:
   - choice
   - rationale
   - alternatives
   - risks
7. User accepts/rejects.
8. Accepted proposal becomes explicit project decision.

## Cost control

- cache resource summaries
- deduplicate URL/repo analysis
- small models for classification
- stronger model only for architecture/recommendation
- per-plan quota
- BYOK may be added later but should not complicate MVP

## Prompt injection boundary

External README/docs/resource pages are **untrusted content**.

When feeding them to AI:
- wrap as untrusted source data
- never allow source text to override system/product instructions
- strip/flag tool-execution requests
- use structured output

## Implemented groundwork (report 45)

The first AI capability exists behind configuration and is **off by default**
(`AI_PROVIDER=none`). It covers exactly one task: proposing a Library Resource
for a slot the owner delegated with `AI_DECIDE`.

- Provider boundary: `apps/api/src/modules/ai/provider.ts` (one typed method
  per capability, content-free `AiProviderError` codes). Adapters:
  `anthropic-provider.ts` (official `@anthropic-ai/sdk`, default model
  `claude-opus-5`, structured output constrained by a Zod schema, optional
  `AI_EFFORT`, server-side refusal fallbacks on models that accept them) and
  `fake-provider.ts` (deterministic, no network; development and tests only,
  refused in production).
- Minimum context: the slot's constraints (allowed/excluded names, notes), the
  brief, the active stack (non-delegated decisions) and up to 80 active
  Library candidates (id, name, type, description, tags). URLs, notes, install
  commands, e-mail and secrets are never sent.
- Prompt-injection boundary: a fixed system prompt; all user or imported text
  travels as escaped JSON inside one `<project_data>` block (`<`, `>` and `&`
  are unicode-escaped, so the text cannot close the tag). The answer is
  validated twice (structured output and the service's own schema); an id
  outside the candidates, a refusal or a truncated answer is a typed failure
  and nothing is stored. Model text is flattened and length-bounded before it
  can become exported rationale.
- Consent and cost: nothing is sent before the user allows it in Settings
  (`workspace_settings.ai_consent_at`); a monthly quota per plan
  (`aiSuggestionsPerMonth`: Free 5, Pro 100, initial bounds to confirm);
  identical pending proposals are reused without a provider call; the `ai`
  rate-limit rule allows 6 requests per minute; an aborted browser request
  cancels the provider call.
- Review and apply: suggestions are stored `pending`; accepting writes an
  ordinary Project decision (`PREFERRED` or `LOCKED`) with the rationale,
  keeping the owner's constraints; a slot that changed meanwhile marks the
  suggestion `stale`. The UI shows the compatibility warnings the choice would
  add before it is accepted.
- Privacy surfaces: `GET /v1/legal` and `GET /v1/account` report whether an
  external AI provider is configured; the account export includes consent and
  every suggestion; deletion cascades.

Activation is an owner decision: set `AI_PROVIDER=anthropic` and `AI_API_KEY`,
confirm the model, effort and quotas, add the provider to
`LEGAL_SUBPROCESSORS` and update the Privacy text before enabling it anywhere
reachable. Tests: `apps/api/test/ai.*.test.ts`, `e2e/ai.spec.ts`.
