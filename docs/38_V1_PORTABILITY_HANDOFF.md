# 38 — V1 Activation, Import and Portable Export Handoff

Target: V1.0 activation and portability / Handoff 9, after
`37_V0_3_RELIABILITY_HANDOFF.md`. Corrective verification completed on 2026-09-07 (full gate green).

The original completion statement was premature: root typecheck failed and
the saved E2E run had nine failures. This report records the corrective pass;
only the results in the verification table below count as current evidence.

## Delivered

### 1. Recipes with inheritance semantics
- Owner-scoped Recipe CRUD (`/v1/recipes`, archive/restore), Recipe decisions
  (`PUT/DELETE /v1/recipes/:id/decisions/:slot`) and Profile attachments with
  priority (`PUT /v1/recipes/:id/profiles`, active and owned only).
- A Project applies one Recipe by reference (`projects.recipe_id`, migration
  0006). Precedence is Project > Recipe > Profile > Global: the Recipe's own
  decisions rank above every Profile, and the Recipe's Profiles contribute
  Profile-scope decisions with the Recipe's attachment priority (a Profile
  attached both directly and through the Recipe counts once, at the higher
  priority). Nothing is copied: editing the Recipe changes the next compile of
  every Project that applies it (tested).
- Decision views carry `recipe` alongside `project`, `profile`, `profiles` and
  `global`; the compiler receives `recipeDecisions` with the Recipe as
  `origin`, so exports read `Source: recipe "…"`. The corrective pass bumps
  `COMPILER_VERSION` to 0.4.1: non-delegated decisions with a null Resource now
  emit `RESOURCE_UNRESOLVED`. Their mode and rationale remain unchanged.
- `POST /v1/projects/:id/save-as-recipe` (Idempotency-Key doubles as the
  Recipe id, conflicts answer 409) mirrors save-as-profile.
- Archived Recipes cannot be applied to new Projects (`recipe_unavailable`) but
  Projects already using them keep inheriting. Clone copies the reference.
- Web: Recipes list and detail (profiles with priority, decision grid, archive),
  Recipe picker in the project wizard with inherited decisions previewed through
  the Recipe, Recipe provenance on the Stack screen and overview, command
  palette links.

### 2. First-run onboarding with skip/resume
- `workspace_settings` (migration 0006) stores `onboarding_state`
  (`new | in_progress | skipped | completed`) and the chosen path.
  `GET /v1/workspace/settings`, `PATCH /v1/workspace/onboarding`.
- The overview shows three first-run choices (sample data, import, "I know my
  stack") plus "Skip for now"; an in-progress state shows a compact resume
  banner; Settings can bring the guide back or mark it complete. The existing
  four-step checklist keeps tracking real progress to the first export.

### 3. Optional sample data
- Versioned catalog (`samples/catalog.ts`, version `1`): eight "Sample ·"
  Resources with Library rules and a compatibility rule, two Profiles, one
  Recipe (profiles + delegation + a DISABLED Redis) and one Project applying
  it. Installed through the regular services so every validation applies.
- `POST /v1/workspace/samples` is atomic and idempotent: the owner settings row
  is locked and all Resources, decisions, tracking and settings share one
  transaction. Failure rolls everything back; eight concurrent calls create
  exactly one set. Library preferences are inserted only into empty slots with
  `ON CONFLICT DO NOTHING`, so existing choices cannot be overwritten.
- `DELETE /v1/workspace/samples` locks the sample entities and refuses with
  `409 samples_in_use` when a non-sample Project, Profile, Recipe, compatibility
  rule or Project's global inheritance uses them. A rejected removal changes
  neither data nor settings. The confirmation explains that edits made to the
  sample entities themselves are removed on a successful cleanup.

### 4. Portable JSON import and export
- `GET /v1/workspace/export` downloads `devcontext-export-<date>.json`
  (`format: "devcontext"`, `version: 1`) with Resources (tags, favorite,
  archived flag, Library rule), Profiles, Recipes, Projects (brief, rules,
  Recipe reference, Profile attachments, attachments, decisions) and
  compatibility rules. No user, session, account, provider, context-version,
  export-event or audit rows are included (tested against seeded secrets).
- `POST /v1/workspace/import` validates the whole document before any write
  (schema, limits, duplicate refs, unknown refs, AI_DECIDE with a Resource,
  self-referencing rules), plans every entity, and returns a dry-run summary by
  default. The same request with `dryRun: false` applies the plan in one
  transaction; an `Idempotency-Key` is recorded in `import_requests` so a retry
  returns the stored summary without importing twice (also under concurrency).
- Duplicate handling is deterministic and explicit: `skip` keeps existing
  items, `copy` creates "(imported)" copies, `replace` overwrites matched items
  including their decisions. Matching keys: Resources by normalized source URL
  or name+type, Profiles by name+type, Recipes and Projects by name, rules by
  (left, right, kind). A Library rule already held by another Resource is kept
  under `skip`/`copy` with a warning and only moved under `replace`.
- Imported prompts, rules, notes and install commands are stored as text;
  URLs must be HTTP(S) and are never fetched. Refs are opaque: another user's
  ids in a file cannot reach that user's rows.
- Future versions are rejected with an explicit message
  (`unsupported_version`); the error envelope now allows domain errors to set a
  public message without exposing input.
- Missing Resource refs preserve unresolved decisions on round trip; non-null
  refs must still resolve inside the file. Export validates the same schema,
  depth and byte limits as import; an unsupported workspace returns
  `409 export_not_portable` instead of an unusable download. Settings presents
  download errors in place.
- Web: Settings page with export download, file import → dry-run table →
  strategy → confirm, sample install/remove, setup-guide controls and a help
  section explaining canonical context, version history and the four modes.

### 5. Compiled bundle
- `GET /v1/projects/:id/context/bundle?version=` returns a deterministic zip
  (`<slug>-context-v<n>.zip`, stored entries, pinned timestamps) with the five
  export files, `devcontext-context.json` (canonical) and a
  `devcontext-bundle.json` manifest. Recorded as an export event with target
  `bundle`. Written with a small in-repo zip writer (`apps/api/src/lib/zip.ts`);
  no dependency added. Individual downloads are unchanged.

## Portable JSON format (version 1)

```text
{
  "format": "devcontext", "version": 1, "exportedAt": ISO-8601,
  "resources": [{ ref, name, type, description, sourceUrl, docsUrl, repoUrl, installCommand,
                  notes, metadata, tags[], favorite, archived, preference: { slot, mode } | null }],
  "profiles":  [{ ref, name, type, description, archived, decisions[] }],
  "recipes":   [{ ref, name, description, archived, profiles: [{ profileRef, priority }], decisions[] }],
  "projects":  [{ ref, name, description, productType, stage, status, platforms[], priorities[], rules[],
                  recipeRef | null, profiles: [{ profileRef, priority }], resourceRefs[], decisions[] }],
  "compatibilityRules": [{ kind, leftRef, rightRef, note }]
}
decision = { slot, mode, resourceRef | null, priority, constraints, rationale, conditions }
```

- `ref` values are opaque keys unique within the file (exports use the source
  ids). Every `resourceRef`, `profileRef`, `recipeRef`, `leftRef` and
  `rightRef` must resolve inside the file.
- Limits: 1000 resources, 200 profiles, 100 recipes, 200 projects, 500 rules,
  80 decisions per entity, 30 tags, 50 attachments, 10 profiles per entity;
  field bounds follow the API contracts. Both compact export files and import
  documents are capped at 32 MiB UTF-8, with a depth limit of 20. The import
  route allows 1024 extra bytes for its envelope; other routes keep 1 MiB.
- `version` greater than 1 is refused with an explicit message. Context
  versions, export history and audit rows are not portable: compile after
  importing.
- The schema lives in `packages/contracts` (`portableDocumentSchema`,
  `portableLimits`, `importRequestSchema`, `importSummarySchema`).

## Data/config changes

- Migration `0006_milky_sheva_callister.sql`: `projects.recipe_id` (FK, set
  null on delete, indexed), `recipes.archived_at`, `workspace_settings`,
  `workspace_samples`, `import_requests`. Applied to the development database;
  replayed in PGlite (from empty and from 0005) and on PostgreSQL. Backup table
  order updated and guarded by `assertTablesCovered`.
- No new environment variables and no dependency added.
- `RepositoryDatabase` is the shared query-builder type for a pool or an
  existing transaction. Sample services are assembled against that transaction
  in `modules/samples/transaction.ts`; no schema change or ADR was needed.
- `scripts/test-e2e.mjs` loads configuration, starts the known local portable
  PostgreSQL when appropriate, creates/migrates a scratch database, runs the
  browser tests, then drops only that scratch database. The API readiness probe
  is `/ready`, not liveness. Tests require CREATEDB; no production connection
  string or provider credential was added.
- Rate limits: bundle, save-as-recipe, samples, export and import are in the
  expensive bucket.
- Audit actions added: `recipe.*`, `workspace.onboarding_updated`,
  `workspace.samples_installed/removed`, `workspace.export_downloaded`,
  `workspace.import_completed` (counts only), `project.exported` with target
  `bundle`.

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass (root `tsc --noEmit` + 8 workspace tasks) |
| `pnpm lint` | pass (root eslint + 8 workspace tasks) |
| `pnpm test` | pass — compiler 16, contracts 6, db 7, web 10, api 127 |
| `pnpm build` | pass (5 tasks) |
| `pnpm test:db` | pass — db 3, api 5 on a scratch PostgreSQL database |
| `pnpm test:e2e` | pass — 11 journeys (Chromium, scratch database, 21.8s) |

Coverage added: `recipes.repository.test.ts` (creation and validation,
Project > Recipe > Profile > Global with Recipe Profiles, compile provenance
and inheritance, archive/apply rules, clone, save-as-recipe idempotency and
conflict, owner isolation), `portability.test.ts` (export shape and secret
exclusion, dry run without mutation, empty-account round trip preserving
decisions and compiled context, replay idempotency, skip/copy/replace,
invalid/future-version/oversized/inconsistent documents, inert command text,
foreign ids as refs), `samples.test.ts` (idempotent install, exact removal,
user data untouched), `zip.test.ts` (round trip, determinism, unsafe paths,
bundle manifest), `portability.routes.test.ts` (export headers, import
preview/apply/replay/version error, Recipe routes, settings/onboarding/samples
routes, audit metadata without content), updated decision/project fixtures,
`e2e/portability.spec.ts` (first-run choice, recipe inheritance on the Stack,
bundle download, export → import round trip with copies, sample removal,
mobile overflow, skip and resume).

Corrective coverage: rollback after tracking/decision/settings failures and
complete retry; existing global preference preservation; six sample-use
conflict cases; pooled PostgreSQL sample concurrency; UTF-8 round trip above
1 MiB; excessive depth/bytes and export bounds; null-resource round trip and
compiler warning; route limit isolation and conflict auditing. E2E now checks
removal refusal, explicit unlinking, successful removal and mobile navigation.
It also fixes DOM `document` shadowing, stale compiler-version assertions,
incorrect parent selectors, the copy count (13 including the compatibility
rule) and a secret check that incorrectly matched the word "password" in a
public tool description. Actual credentials and auth fields remain checked.

Mobile workspaces previously hid the entire sidebar without a replacement.
`workspace-shell.tsx` now exposes all six routes and sign-out in a compact
mobile header, preserving active-route and keyboard-focus indications.

## Acceptance criteria

- a new user reaches first export without founder intervention — first-run
  choices, sample data with a compiled project, checklist and bundle download
  covered by Playwright
- users can leave with their structured data — versioned export without
  secrets; round-trip import verified
- import cannot execute or silently overwrite anything — validation before
  mutation, dry run by default, explicit strategy, inert text, HTTP(S)-only URLs
- full verification gate — table above; do not advance while any row is pending

## Known risks and notes

- Recipe Profiles appear as ordinary Profile provenance on the Stack; the
  Recipe row on the overview and the wizard explain where they come from.
- Sample-use protection is deliberately conservative: an archived non-sample
  entity still counts as a reference. Remove its links and inherited global
  preferences before deleting samples. Existing partial installations created
  by the old non-atomic code are not silently rewritten; inspect them before
  choosing to remove/reinstall, especially if users edited them.
- Import matches by name/URL only; renamed items will be created as new under
  `skip`. `replace` is the explicit way to update them.
- Very large or unsupported workspaces receive an explicit error; a streamed
  administrative/account export above the portable format bounds is still a
  separate launch task. This JSON format excludes historical/account records.
- Billing, account recovery/deletion, legal surfaces, hosted CI, managed backups
  and production monitoring remain outside this corrective Handoff 9 slice.

Next prompt: prompts/claude-code-production/09_H10_V1_BILLING_ENTITLEMENTS.md
