# Handoff 4 — Projects and Wizard Persistence

Use this after `00_SESSION_BOOTSTRAP.md` and a clean current-state audit.

## Target

Complete the V0.1 Minimal Projects vertical slice: authenticated Project CRUD,
recoverable archive/restore, wizard persistence and manual attachment of active
Library Resources.

## Existing partial work

Inspect, preserve and validate the partial migration described in
`docs/30_PRODUCTION_EXECUTION_PLAN.md`. `projects.clientRequestId`,
`projectResources` and migration `0002_sturdy_magik.sql` may already exist while
the API and UI do not. Never regenerate or delete an applied migration blindly.

## Required behavior

### Contracts and domain

- Define Zod create, update, list/query and response contracts.
- Store name, stable slug, description, product type, lifecycle stage,
  platforms, priorities, status and attached Resource summaries.
- Normalize repeated string-list values without losing explicit user choices.
- Use a caller-generated UUID or `Idempotency-Key` so a retried Project create
  returns the same Project instead of duplicating it.
- Archive by default; provide an explicit restore action.

### Persistence

- Implement repository and service layers; keep Fastify handlers thin.
- Scope every Project query/count/write to the session owner.
- When attaching Resource IDs, validate that every Resource belongs to the same
  owner and is active. Treat missing, foreign or archived IDs identically so the
  API does not leak their existence.
- Create/update Project plus attachment changes atomically.
- Existing attachments remain visible if a Resource is archived later.

### API

Implement under `/v1`:

- `GET /projects` with bounded search/status pagination;
- `POST /projects`;
- `GET /projects/:id`;
- `PATCH /projects/:id`;
- `DELETE /projects/:id` as archive;
- `POST /projects/:id/restore`;
- a documented replace/attach/detach Resource contract if attachment changes are
  not handled directly by create/update.

### Web

- Add a real `/workspace/projects` navigation destination.
- Build a progressive, accessible Project wizard rather than one giant form.
- Minimum steps: brief, stage/platform/priorities, choose saved Library Resources,
  review, create.
- Keep a live Project summary visible on desktop and usable inline on mobile.
- Build active/archive list views with search, edit, open, archive and restore.
- Add a protected Project overview route that shows stored brief and attached
  Resource references. Decision editing belongs to Handoff 5.
- Make dashboard Project counts and recent Projects use real API data.

## Do not implement

- profiles or recipes;
- DecisionControl/project decision editing;
- compiler/export logic;
- AI suggestions, URL enrichment, billing or teams.

## Tests

- unit tests for slug/list normalization and create idempotency behavior;
- API tests for validation, CRUD, archive/restore and owner isolation;
- persistence/integration coverage for same-owner active Resource attachment and
  rejection of foreign/archived Resources;
- Playwright: sign in → create Project through wizard → attach a saved Resource →
  open/edit → archive → restore;
- desktop and mobile overflow/accessibility smoke checks.

## Acceptance criteria

- repeated create cannot duplicate a Project;
- user A cannot read/change or attach data owned by user B;
- all wizard values survive refresh and edit;
- archive is recoverable and does not delete attached Library data;
- full verification gate passes.

## Deliverable

Update API/backlog/execution-plan docs and create `docs/32_PROJECTS_HANDOFF.md`.
End it with:

`Next prompt: prompts/claude-code-production/03_H05_DECISIONS.md`
