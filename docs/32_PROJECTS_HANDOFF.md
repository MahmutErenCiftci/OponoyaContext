# 32 — Projects Handoff

Target: V0.1 Minimal Projects / Handoff 4. Completed 2026-09-07 after the
current-state audit (`31_CURRENT_STATE_AUDIT.md`).

## Delivered

- authenticated Project create, read, edit, list, archive and restore, all
  scoped to `request.currentUser.id`; caller-supplied owner headers and IDs are
  ignored
- stored brief: name, stable slug (name + short ID suffix, fixed at create),
  description, product type, lifecycle stage (`experiment | mvp | production |
  maintenance`), platforms, priorities, status (`active | archived`)
- list normalization that trims, drops blanks and removes case-insensitive
  duplicates while keeping the user's spelling and order
- idempotent create: a UUID `Idempotency-Key` header (preferred) or body
  `clientRequestId` makes a retried create return the original Project with
  `200` instead of creating a duplicate (`201`)
- manual attachment of active Library Resources via `resourceIds` on create and
  update. Project row and attachments are written in one transaction. Missing,
  foreign and archived IDs are rejected identically with
  `VALIDATION_ERROR` + `details[{ path: ["resourceIds", "<index>"], code:
  "resource_unavailable" }]`, so the API never reveals whether another user's
  Resource exists
- attachments stay visible and editable after a Resource is archived later
  (`archivedAt` is reported per attachment); newly selecting an archived
  Resource is still rejected
- archive keeps attachments and Library data; restore is explicit
- `/workspace/projects`: active/archive views, search, open, edit, archive,
  restore, empty states
- progressive four-step Project wizard (brief → stage, platforms and
  priorities → Library resources → review) with a live summary panel on
  desktop that becomes a compact inline card on mobile, keyboard-usable
  stepper, radio cards, pressed-state chips with custom entries, debounced
  Library search and a per-wizard idempotency key
- `/workspace/projects/:id` protected overview with the stored brief, attached
  Resource references (archived ones flagged), archive/restore actions and a
  placeholder card stating that stack decisions arrive in Handoff 5
- dashboard shows the real active-project count and up to three recent Projects
- Projects entry in the workspace navigation; the "Projects" nav item is a real
  destination

## API

- `GET /v1/projects?q=&status=active|archived|all&stage=&limit=&offset=`
- `POST /v1/projects` (`Idempotency-Key` header or `clientRequestId`)
- `GET /v1/projects/:id`
- `PATCH /v1/projects/:id` (`resourceIds` replaces attachments when present)
- `DELETE /v1/projects/:id` → archive
- `POST /v1/projects/:id/restore`

Details in `17_API_CONTRACTS.md`. The error handler now forwards safe domain
`details` (paths and codes only) alongside Zod validation details.

## Data/config changes

- No new migration. Migration `0002_sturdy_magik.sql`
  (`projects.client_request_id`, `project_resources`) is now exercised by the
  repository, its PGlite test, the PostgreSQL replay test and the Playwright
  journey. It must not be regenerated.
- `@devcontext/db` exports `asc` and `sql` in addition to the existing Drizzle
  operators and gains a test-only `@devcontext/db/testing` entry
  (`createTestDatabase()`: PGlite with all migrations applied). This avoids
  adding driver dependencies to `apps/api`; PGlite remains a dev dependency of
  the db package. `apps/api/package.json` and the lockfile are unchanged from
  Handoff 3.
- Shared `slugify` helper in `apps/api/src/lib/slug.ts`, now used by Resources
  and Projects.
- Web: shared `lib/errors.ts` (API error envelope reader) and
  `lib/resource-labels.ts` (type/stage labels, suggestions, UTC date format)
  replace helpers previously inlined in the Library client.
- No environment variables were added or changed.

## Verification (this workspace, Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass — contracts 5, db 2, compiler 4, web 7, api 35 (incl. 4 PGlite repository tests) |
| `pnpm build` | pass; new routes `/api/projects/[[...path]]`, `/workspace/projects`, `/workspace/projects/[id]` |
| `pnpm test:db` | pass against PostgreSQL 18.6 |
| `pnpm test:e2e` | pass — 3 journeys (foundation ×2, projects ×1) |

Test coverage added:

- contracts: project create/update/list/response schemas and the idempotency
  key format
- `projects.service.test.ts`: slug generation, list normalization, retried
  create returning the same Project, header key precedence, attachment
  validation, replace-only-when-provided semantics, owner isolation,
  archive/restore
- `projects.routes.test.ts`: authentication, owner scoping, payload and header
  validation, `201`/`200` replay, detail passthrough without leaking IDs, thin
  edit/archive/restore handlers
- `projects.repository.test.ts` (PGlite): same-owner active attachment,
  identical rejection of foreign/archived/unknown IDs with rollback, archived
  attachment visibility and edit rules, owner isolation, search, archive and
  restore
- `app.test.ts`: unauthenticated `POST /v1/projects` now returns 401
- `e2e/projects.spec.ts`: sign up → add Resource → wizard (validation, stage,
  platforms, custom priority, attachment, review) → create → overview →
  refresh → edit → save → archive → restore → open → dashboard recent list;
  desktop and mobile overflow checks with screenshots

Visual inspection: wizard review, project overview and project list were checked
at 1440px and 390px from the Playwright screenshots; no horizontal overflow. One
defect found and fixed during inspection: the landing page styles bare `footer`
elements globally, which shrank the wizard's sticky action bar and let review
rows show through on mobile. The bar is now a `div` with an opaque background on
small screens. Avoid bare element selectors in new CSS for the same reason.

## Acceptance criteria

- repeated create cannot duplicate a Project — service, route and PGlite tests
- user A cannot read/change or attach data owned by user B — route, service and
  PGlite tests; attachment rejection is indistinguishable for foreign, archived
  and unknown IDs
- all wizard values survive refresh and edit — Playwright reload and edit steps
- archive is recoverable and does not delete attached Library data — PGlite test
  counts `project_resources` after archive; Playwright restores the Project
- full verification gate passes — table above

## Known risks and notes

- Playwright's Chromium had to be (re)installed on this workspace with
  `pnpm exec playwright install chromium`; CI already runs that step.
- `pnpm install` was run twice while evaluating a test-dependency approach; the
  final lockfile matches the Handoff 3 dependency set (no new packages).
- Wizard drafts are not persisted before the first save; persisted Project
  values survive refresh as required. Draft persistence can be considered with
  onboarding work in V0.3.
- Project `stage`/`status` remain text columns validated by the API; a database
  enum can be introduced in a forward migration if needed later.
- Hosted CI has still not run because the repository is not published.

Next prompt: prompts/claude-code-production/03_H05_DECISIONS.md
