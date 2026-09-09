# Handoff 8A — V0.3 Usability and Explainability

Use this after the V0.2 composer handoff.

## Target

Make the core Library → Project → Context loop fast, understandable and safe for
private beta without adding Discover, external AI or team permissions.

## Required slices

Implement these as coherent subcommits/patch groups inside this handoff, keeping
the application runnable after each group:

1. fast global search across the current user's Resources, Projects, Profiles and
   Recipes using PostgreSQL-native indexing/search appropriate to measured data;
2. Resource favorites, useful saved filters and stronger duplicate detection;
3. manually curated compatibility rules with hard-conflict/missing-requirement
   warnings that never auto-replace a choice;
4. Project clone and save-as-Profile/Recipe actions with idempotent transactions;
5. semantic context diff showing decision/resource/mode/warning changes, not only
   raw Markdown;
6. onboarding/checklist that guides the user to five Resources, one Project, one
   compile and one export without forcing dozens of preferences.

## UX expectations

- Keep information density useful; avoid vanity charts and excessive cards.
- Explain duplicate and compatibility findings with evidence and user-controlled
  actions.
- Show inheritance/provenance and Project impact before changing shared context.
- All essential actions remain keyboard accessible and work at mobile width.
- Empty, loading, error, stale and partial-data states are explicit.

## Security and data rules

- Every search/result/count is owner-scoped.
- Duplicate URLs warn; they do not hard-block.
- Cloning never references another owner's entities.
- Compatibility evaluation is deterministic and local; no URL fetch or LLM call.
- Existing context history is immutable/readable after current data changes.

## Tests

- search isolation and indexing/migration replay;
- favorites/filters and duplicate variants;
- conflict/requirement warnings without mutation;
- clone idempotency and complete attachment/decision copy rules;
- semantic diff fixtures;
- Playwright onboarding and Project clone/diff happy paths;
- desktop/mobile visual smoke checks.

## Acceptance criteria

- a user can find and reuse context without manual browsing;
- warnings are explainable and never destructive;
- clone/diff/onboarding survive refresh and error states;
- no known data-loss path exists in these features;
- full verification gate passes.

## Deliverable

Update docs/backlog/execution plan and create `docs/36_V0_3_USABILITY_HANDOFF.md`.
End it with:

`Next prompt: prompts/claude-code-production/07_H08B_V0_3_RELIABILITY.md`
