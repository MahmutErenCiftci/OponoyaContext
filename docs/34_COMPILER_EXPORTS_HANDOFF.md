# 34 — Compiler, Versions and Exports Handoff

Target: V0.1–V0.2 deterministic Context Compiler, persisted versions and first
exports / Handoff 6. Completed 2026-09-07 after `33_DECISIONS_HANDOFF.md`.

## Delivered

### Pure compiler (`packages/context-compiler`, COMPILER_VERSION 0.2.0)

- canonical object built before any format-specific output: project brief,
  winning decisions with provenance (`source`) and every shadowed
  lower-precedence decision, active resources, reserved `rules`, warnings
- precedence `project > recipe > profile > global`; same-scope ties break by
  explicit priority, then newest revision, then id. Profile and recipe inputs
  are accepted and empty until Handoff 7.
- `AI_DECIDE` renders as a deliberate delegation with its constraints and never
  requires a Resource; `DISABLED` renders under "Do not use" and is excluded
  from the active resource list
- attached Project Resources and exact component references (source, docs,
  repository, install command) are included; private notes are not exported
- structured warnings that never mutate input: `RESOURCE_UNRESOLVED`,
  `RESOURCE_ARCHIVED`, `RESOURCE_CONFLICT` (same Resource disabled in one slot
  and selected in another), `DISABLED_RESOURCE_ATTACHED`
- locale-independent sorting, `stableStringify` (sorted keys) and
  `hashCanonical` (SHA-256, `@devcontext/context-compiler/hash`) so identical
  input yields byte-identical canonical JSON and hash
- export adapters consuming only the canonical object: generic master prompt,
  `AGENTS.md`, `CLAUDE.md`, Cursor `.cursor/rules/devcontext.mdc`, Copilot
  `.github/copilot-instructions.md`; `renderExport(target, canonical)` returns
  file name and content

### API (`apps/api/src/modules/context`)

- owner-scoped compile input loader (project, attachments, global and Project
  decisions, referenced Resources incl. archived ones)
- `POST /v1/projects/:id/compile` stores a new monotonic version only when the
  canonical hash changed (`201`), otherwise returns the latest version (`200`).
  A `SELECT … FOR UPDATE` on the Project row serializes concurrent compiles.
- `GET /v1/projects/:id/context` returns the latest version with all five
  previews plus `stale`/`draftHash`/`draftWarnings` computed from a fresh
  in-memory compile
- `GET /v1/projects/:id/context/versions` and `/versions/:version`
- `POST /v1/projects/:id/exports` renders a stored version (latest or explicit)
  and records an export event; a UUID `Idempotency-Key` makes retries return the
  original event. Uncompiled Projects answer `409` with
  `details[{ path: ["version"], code: "context_not_compiled" }]`.
- `GET /v1/projects/:id/exports` lists export history
- compiler output is validated against `canonicalContextSchema` before storage

### Web

- `/workspace/projects/:id/context`: status card (not compiled / changes since
  version n / n warnings / clean), compile action, version and hash, warning
  panel, target tabs (master prompt, AGENTS.md, CLAUDE.md, Cursor, Copilot,
  canonical JSON) with text-only preview, copy and download, version history with
  read-only viewing of older versions, export history
- `Context` tab in the Project header; the same-origin proxy already covers
  the nested routes
- copied/exported text is rendered as plain text only

## Data/config changes

- No migration. `context_versions` and `export_events` from migration 0000 are
  used as designed (`export_events.metadata` stores `fileName` and the optional
  `idempotencyKey`).
- `@devcontext/context-compiler` gains a `./hash` entry point; `examples/
  generated-context` now holds `expected-canonical.json` and a regenerated
  `EXPECTED_MASTER_PROMPT.md`, both asserted by `examples.test.ts`.
- Contracts: export target, canonical context, context version, compile,
  context state and export schemas.
- No environment changes.

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass — compiler 11 (golden snapshots regenerated for 0.2.0), contracts 6, db 2, web 7, api 54 (incl. PGlite context tests) |
| `pnpm build` | pass; new route `/workspace/projects/[id]/context` |
| `pnpm test:db` | pass |
| `pnpm test:e2e` | pass — 5 journeys (foundation ×2, projects, decisions, context) |

Coverage added:

- compiler: full precedence chain with provenance, same-scope tie-breaks,
  AI Decide delegation, Disabled as negative instruction, conflict and
  attachment warnings, exact component references, order independence and
  byte-stable hashing, adapter parity; golden snapshots for the canonical
  object, its hash and all five adapters; example fixture parity
- `context.service.test.ts`: duplicate-hash suppression, monotonic numbering,
  stale detection, version history, export gating (`409`), idempotent export
  events, owner isolation on every operation
- `context.routes.test.ts`: authentication, foreign Project 404 on all six
  routes, `201`/`200` compile, version parameter validation, export validation
  and idempotency header
- `context.repository.test.ts` (PGlite): owner-scoped input loading, stored
  canonical shape, concurrent compile producing one version, earlier versions
  readable and hash-stable after a Resource is archived and renamed, archived
  warning on recompile, idempotent export events with version numbers, owner
  isolation
- `e2e/context.spec.ts`: Library → Project with attachment → compile → clean →
  AGENTS.md preview → download (`AGENTS.md`) → export history → no-change
  compile → lock decision → stale banner → version 2 → view version 1 → back to
  current → canonical JSON; desktop/mobile overflow checks

## Acceptance criteria

- a real Project generates useful stable instructions — Playwright journey and
  example fixture
- previous versions remain readable after Resource archive/edit — PGlite test
- identical input does not create version noise — service, PGlite and
  Playwright ("No changes since version 1")
- every exporter preserves canonical meaning — adapter parity test and golden
  snapshots; adapters only wrap the generic body
- full verification gate passes — table above

## Known risks and notes

- The dashboard "Context exports" metric is still static; a workspace-wide
  count arrives with V0.3 usability work.
- Compatibility rules beyond the four structural warnings (requires/conflicts
  tables) are V0.3 scope.
- Browser clipboard access can be denied; the UI reports the failure and the
  preview remains selectable.
- Bare element selectors in the landing CSS (`footer`) bit the wizard earlier;
  the Context screen uses class selectors only.

Next prompt: prompts/claude-code-production/05_H07_COMPOSER_PROFILES.md
