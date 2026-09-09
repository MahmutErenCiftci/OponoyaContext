# Handoff 5 — DecisionControl and Project Decisions

Use this after Handoff 4 is complete and reported.

## Target

Implement the shared decision mental model for global and Project scopes so the
user can explicitly choose, prefer, delegate or forbid a technology.

## Required semantics

- Modes are exactly `LOCKED | PREFERRED | AI_DECIDE | DISABLED`.
- `AI_DECIDE` may have no Resource; other technology decisions normally require
  an active same-owner Resource.
- Slot keys are stable, namespaced and validated.
- One effective decision exists per exact scope/slot.
- A Project decision shadows a global decision; it never deletes the inherited
  global record.
- Archived Resources cannot be newly selected. Existing decisions referencing a
  Resource archived later remain readable and visibly flagged.
- Compatibility warnings are informational here and never mutate a decision.

## API and persistence

Implement thin routes backed by service/repository layers:

- `GET /v1/projects/:id/decisions` returning explicit decisions plus inherited
  global preview and provenance;
- `PUT /v1/projects/:id/decisions/:slot` as an idempotent upsert;
- `DELETE /v1/projects/:id/decisions/:slot` to reveal inheritance again;
- any focused global-preference endpoint needed to make Library behavior
  consistent, without duplicating existing Resource preference mutations.

Validate ownership through Project and Resource joins. A foreign Project or
Resource must not be distinguishable from a missing one. Use transactions for
multi-table effects.

## Web

- Create one reusable accessible `DecisionControl` component.
- Add Project Stack groups at minimum for frontend, backend, database, auth,
  design and AI development.
- Each row shows slot, explicit/effective mode, selected Resource or deliberate
  AI delegation, and provenance (`Project` or `Global`).
- The editor supports mode, Resource search from the active Library, constraints
  and rationale, plus remove-override behavior.
- Do not encode mode by color alone; always show a text label.
- Make `AI_DECIDE` look intentional, not like missing data.

## Do not implement

- profiles/recipes or their precedence;
- LLM recommendations;
- automatic conflict resolution;
- compiler persistence or exports.

## Tests

- mode/resource domain validation;
- global inheritance and Project shadowing without deletion;
- AI Decide with null Resource;
- owner isolation across nested Project/Resource routes;
- archived Resource selection rejection and archived-reference visibility;
- Playwright adds a locked frontend choice and an AI Decide backend slot, then
  removes one override and sees global inheritance return.

## Acceptance criteria

- all four modes work through API and UI;
- provenance is visible and correct;
- no IDOR path exists through nested routes;
- the UI state survives refresh;
- full verification gate passes.

## Deliverable

Update contracts/docs/backlog/execution plan and create
`docs/33_DECISIONS_HANDOFF.md`. End it with:

`Next prompt: prompts/claude-code-production/04_H06_COMPILER_EXPORTS.md`
