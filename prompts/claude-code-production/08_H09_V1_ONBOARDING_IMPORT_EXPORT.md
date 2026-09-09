# Handoff 9 — V1 Activation, Import and Portable Export

Use this after V0.3 beta reliability is complete.

## Target

Prepare the individual-user product experience for launch: reusable Recipes,
useful first-run data, safe imports and portable exports that complete the
activation funnel.

## Required behavior

- Complete owner-scoped Recipe CRUD and Recipe decisions. Applying a Recipe uses
  inheritance/reference semantics, participates in `Project > Recipe > Profile >
  Global` precedence and never creates a disconnected copied decision blob.
- Finish first-run onboarding and setup-completeness UI with skip/resume behavior.
- Offer optional sample Resources/Project without silently adding them. Seed data
  must be versioned, idempotent and removable.
- Import a documented, bounded DevContext JSON format for the user's own Library,
  Profiles, Recipes and Projects. Validate the entire document before mutation,
  show a dry-run summary and require confirmation.
- Treat imported prompts/rules as inert data. Never execute commands or fetch URLs.
- Define deterministic duplicate handling: skip, create copy or explicit replace;
  never silently overwrite.
- Export the user's structured DevContext data in a versioned portable JSON
  format with no auth/session/provider secrets.
- Make compiled target files downloadable individually and as a safe bundle with
  stable filenames and content types.
- Add settings/help surfaces explaining canonical context, version history and
  the four decision modes.

## API and persistence

- Import is transactional and idempotent via an import request ID.
- Enforce payload/file count/size/depth limits.
- Owner-scope every import reference and export query.
- Record import/export audit metadata without storing full private payloads in
  logs or analytics.
- Add a schema version and explicit future-version rejection message.

## Tests

- round-trip export → empty account import preserves supported semantics;
- Recipe inheritance/override and cross-owner isolation;
- dry-run causes no mutation;
- invalid/cross-owner/future-version/oversized imports are rejected safely;
- duplicate strategy and import retry idempotency;
- secret/token fields never appear in exported bundles;
- Playwright first-run sample choice and import/export journey.

## Acceptance criteria

- a new user reaches first export without founder intervention;
- users can leave with their structured data;
- import cannot execute or silently overwrite anything;
- full verification gate passes.

## Deliverable

Document the file format, update backlog/execution plan and create
`docs/38_V1_PORTABILITY_HANDOFF.md`. End it with:

`Next prompt: prompts/claude-code-production/09_H10_V1_BILLING_ENTITLEMENTS.md`
