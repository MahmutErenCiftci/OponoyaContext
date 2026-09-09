# 33 — Decisions Handoff

Target: V0.1–V0.2 DecisionControl and Project decisions / Handoff 5. Completed
2026-09-07 after `32_PROJECTS_HANDOFF.md`.

## Delivered

- Project decisions per stable, namespaced slot with the four modes
  `LOCKED | PREFERRED | AI_DECIDE | DISABLED`
- `AI_DECIDE` is stored without a Resource and rejected if one is supplied
  (`resource_not_allowed`); every other mode requires an active same-owner
  Resource (`resource_required`, `resource_unavailable`). Missing, foreign and
  archived Resources fail identically.
- one effective decision per Project/slot through an idempotent upsert on the
  existing `(project_id, slot)` unique index
- inheritance: the Library's global preference for a slot appears as an
  inherited decision (`source: "global"`); a Project decision shadows it and the
  global row is never modified or deleted; removing the override reveals the
  global rule again
- decisions whose Resource is archived later stay readable and carry
  `archivedAt`; re-selecting an archived Resource is rejected
- reusable accessible `DecisionControl` component (mode radio cards with text
  labels and descriptions, owner-scoped Library Resource search, allowed and
  excluded option chips, constraint notes, rationale) used by the Project Stack
  editor and ready for profiles/recipes
- `/workspace/projects/:id/stack` with groups for frontend, backend, data,
  identity & storage, design, AI development and infrastructure, plus custom
  `custom.*` slots; every row shows slot, effective mode as text, chosen Resource
  or an intentional "Delegated to the coding agent" state, and provenance
  (`Project` / `Global` / not set)
- decision editor drawer with inheritance note and remove-override action
- Project header with Overview/Stack tabs; the overview shows a decision summary
  (project, inherited, delegated counts) and the first decisions
- proxy route now forwards `PUT` so nested decision routes work same-origin

## API

- `GET /v1/projects/:id/decisions` → `{ decisions: ProjectDecisionView[] }` with
  `slot`, `source`, `effective`, `project` (override or `null`) and `global`
  (inherited rule or `null`), sorted by slot
- `PUT /v1/projects/:id/decisions/:slot` → idempotent upsert; body
  `upsertProjectDecisionSchema`
- `DELETE /v1/projects/:id/decisions/:slot` → removes only the override;
  returns the inherited view or `null`

Slots are validated with `decisionSlotSchema` (`frontend.framework`,
`custom.date_library`). Details in `17_API_CONTRACTS.md`.

## Data/config changes

- No migration. `project_decisions` and `global_decisions` from migration 0000
  are used as designed.
- Contracts: `resourceReferenceSchema` now backs both Project attachment
  summaries and decision Resource references; the old `upsertDecisionSchema`
  sketch was replaced by `upsertProjectDecisionSchema`,
  `decisionRecordSchema`, `projectDecisionViewSchema` and the two response
  schemas.
- Web: shared `components/chip-field.tsx` (extracted from the Project wizard),
  `components/decision-control.tsx`, `lib/decision-slots.ts` (slot groups,
  labels, constraint helpers).
- No environment changes.

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass — contracts 6, db 2, compiler 4, web 7, api 45 (incl. 4 PGlite decision tests) |
| `pnpm build` | pass; new route `/workspace/projects/[id]/stack` |
| `pnpm test:db` | pass |
| `pnpm test:e2e` | pass — 4 journeys (foundation ×2, projects, decisions) |

Coverage added:

- `decisions.service.test.ts`: mode/Resource validation, shadowing without
  deletion, inherited-only slots, AI Decide with null Resource, remove revealing
  inheritance, 404 for foreign Projects
- `decisions.routes.test.ts`: authentication, nested owner isolation on all
  three routes, slot and payload validation, detail codes without IDs
- `decisions.repository.test.ts` (PGlite): inherited global row visible,
  override shadows and keeps the global row, idempotent upsert, AI Decide
  constraints, identical rejection of foreign/archived/unknown Resources,
  archived-later Resource stays readable and flagged, owner isolation
- `e2e/decisions.spec.ts`: Library preference → project → Stack shows inherited
  PREFERRED → lock frontend framework → delegate backend framework with allowed
  options → reload → remove override → inheritance returns → overview summary;
  desktop and mobile overflow checks with screenshots

Visual inspection at 1440px and 390px from the Playwright screenshots: rows
wrap to a two-line layout on mobile; mode is always a text badge.

## Acceptance criteria

- all four modes work through API and UI — tests above and the Playwright flow
  (LOCKED, PREFERRED inherited, AI_DECIDE; DISABLED covered by contracts/service
  paths and the same UI control)
- provenance is visible and correct — `source` in the API, `Project`/`Global`
  badges and inheritance note in the UI
- no IDOR path through nested routes — route and PGlite tests for foreign
  Projects and Resources
- UI state survives refresh — Playwright reload step
- full verification gate passes — table above

## Known risks and notes

- Compatibility warnings are not computed yet (Handoff 6/8A); the editor only
  flags archived Resources.
- `priority` and `conditions` are stored and round-tripped but not editable in
  the UI yet; the compiler will use `priority` for same-scope tie-breaks.
- Global preferences are still edited only through the Library (Resource
  editor); a Project cannot create a global rule, by design.

Next prompt: prompts/claude-code-production/04_H06_COMPILER_EXPORTS.md
