# 36 — V0.3 Usability and Explainability Handoff

Target: V0.3 usability beta / Handoff 8A. Completed 2026-09-07 after
`35_COMPOSER_HANDOFF.md`.

## Delivered

### 1. Global search
- `GET /v1/search?q=&limit=` across the owner's Resources, Projects, Profiles and
  Recipes (name and description, owner-scoped in every query), ranked exact →
  prefix → substring → description hit, active before archived, then
  Resources → Projects → Profiles → Recipes
- migration 0004 adds `lower(name)` expression indexes on resources, projects and
  profiles; `pg_trgm` is the documented upgrade path once data volume justifies it
- command palette in the workspace shell (button or Ctrl/Cmd+K): quick actions,
  grouped results, arrow/enter/escape keyboard navigation, explicit loading,
  empty and error states; Library accepts `?q=` and `?view=` so results deep-link

### 2. Favorites, saved views and duplicate detection
- `resources.favorite` (migration 0004) with `PATCH /v1/resources/:id
  { favorite }`, `favorite=true|false` list filter and favorites-first ordering
- Library quick views (All, Favorites, Components, Prompts, Repositories, AI
  tools) mirrored in the URL so they work as bookmarks and survive refresh
- duplicate detection normalizes source URLs (scheme, `www.`, trailing slash,
  fragment, tracking parameters, case) and names (case, punctuation) per type;
  mutations return `warnings` (`DUPLICATE_SOURCE_URL`, `DUPLICATE_NAME`) plus
  `duplicates[]` evidence, never blocking the save; the UI shows the matching
  resources with links

### 3. Compatibility rules
- owner-curated `compatibility_rules` (`conflicts` / `requires`, optional note;
  migration 0004) with `GET/POST/DELETE /v1/compatibility-rules`; both Resources
  must be active and owned, reported per side
- compiler 0.4.0 evaluates rules against the active stack only and emits
  `RULE_CONFLICT` / `MISSING_REQUIREMENT` warnings with the note as evidence;
  decisions are never replaced
- Library resource editor gains a Compatibility section; the Stack screen shows
  "Impact warnings" from a fresh draft compile before anything is compiled

### 4. Clone and save-as-profile
- `POST /v1/projects/:id/clone` copies brief, rules, attachments, profile
  attachments and project decisions in one transaction; `Idempotency-Key`
  becomes the clone's client request id so retries return the same clone
- `POST /v1/projects/:id/save-as-profile` creates a Profile from the Project's
  explicit decisions; the `Idempotency-Key` doubles as the Profile id so a
  replay returns the existing Profile
- overview actions "Clone" and "Save as profile" with explicit dialogs;
  recipes stay out of scope until V1.0 (Handoff 9)

### 5. Semantic context diff
- `diffContexts()` in `@devcontext/context-compiler/diff`: brief field changes,
  decisions added/removed/changed (mode, resource, source, constraints,
  rationale), resources and rules added/removed, warnings new/resolved,
  compiler version changes
- `GET /v1/projects/:id/context/diff?from=&to=` (defaults: latest and the one
  before); Context screen "Diff" tab with version selectors and explicit
  single-version and identical states

### 6. Onboarding
- `GET /v1/workspace/summary` (owner-scoped counts) feeds real dashboard metrics
  and a four-step checklist: five Resources, one Project, one compile, one export,
  each with progress and a direct action; unavailable counts are called out

## Data/config changes

- Migration `0004_overrated_spitfire.sql`: `resources.favorite`,
  `compatibility_rules` table with enum `compatibility_kind`, expression indexes
  `resources_owner_lower_name_idx`, `projects_owner_lower_name_idx`,
  `profiles_owner_lower_name_idx`. Applied to the development database; replayed
  in PGlite and PostgreSQL tests.
- Compiler `0.3.0 → 0.4.0` (compatibility warnings, new `./diff` entry);
  goldens and `examples/generated-context` regenerated.
- Better Auth rate limiting is disabled only when `NODE_ENV=test` so parallel
  Playwright journeys can each sign up; development and production keep the
  documented limits.
- No environment variable changes.

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass — compiler 15, contracts 6, db 2, web 7, api 70 |
| `pnpm build` | pass |
| `pnpm test:db` | pass (migration 0004 replayed) |
| `pnpm test:e2e` | pass — 7 journeys (foundation ×2, projects, decisions, context, composer, usability) |

Coverage added:

- compiler: rule conflict/requirement warnings without mutation, semantic diff
  fixtures (identical, brief/decision/resource/rule/warning changes)
- `resources.service.test.ts`: URL/name normalization, duplicate evidence,
  favorites; `resources.routes.test.ts`: favorite toggle and filter
- `usability.repository.test.ts` (PGlite): duplicate variants and favorites,
  owner-scoped ranked search (archived last, foreign owner hidden, wildcard
  characters escaped), compatibility rules with per-side rejection and
  compile-time warnings, complete and idempotent clone, save-as-profile
  idempotency, semantic diff over stored versions with immutable history,
  workspace summary counts
- `usability.routes.test.ts`, plus new route cases for clone, save-as-profile
  and diff in the existing route suites
- `e2e/usability.spec.ts`: checklist progress, favorites and quick views
  surviving refresh, duplicate evidence toast, curated rule → impact warning →
  resolved in diff, palette search navigation, clone with fresh history,
  save-as-profile, mobile overflow check

## Acceptance criteria

- a user can find and reuse context without manual browsing — palette search,
  favorites, saved views, clone and save-as-profile
- warnings are explainable and never destructive — duplicate evidence lists,
  rule notes in warning messages, no automatic replacement anywhere
- clone/diff/onboarding survive refresh and error states — server-rendered
  data plus explicit loading/error/empty states; PGlite and Playwright coverage
- no known data-loss path — clones and profiles are additive; history stays
  immutable (tested)
- full verification gate passes — table above

## Known risks and notes

- Search uses `ILIKE` with expression indexes; switch to `pg_trgm` when Library
  sizes make substring search slow.
- Duplicate detection only compares against the owner's active Resources;
  archived duplicates are ignored on purpose.
- Compatibility rules are per owner and manual; no curated global rule set ships
  yet.
- The palette navigates Resources to a filtered Library view because Resources
  have no detail page yet.

Next prompt: prompts/claude-code-production/07_H08B_V0_3_RELIABILITY.md
