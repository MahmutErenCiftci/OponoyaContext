# 35 — Composer and Profiles Handoff

Target: V0.2 Project Composer and Profiles / Handoff 7. Completed 2026-09-07
after `34_COMPILER_EXPORTS_HANDOFF.md`.

## Delivered

### Profiles

- owner-scoped Profile CRUD for types `stack`, `design`, `ai` and `deployment`
  with stable slugs, description, soft archive and restore
- Profile decisions use the same payload, validation and Resource rules as
  Project decisions (`AI_DECIDE` without Resource, active same-owner Resource
  otherwise, identical rejection of missing/foreign/archived IDs)
- `/workspace/profiles` list (search, type filter, active/archive) with a
  create/edit drawer, and `/workspace/profiles/:id` showing every slot group
  with the shared `DecisionEditor`; archived Profiles are flagged and cannot be
  attached to new Projects, while Projects already using them keep inheriting

### Project composition

- Projects attach multiple Profiles with an explicit priority through
  `projects.profiles` on create/update and `PUT /v1/projects/:id/profiles`
  (replace set; retained attachments stay valid even when archived later)
- Projects store explicit engineering `rules` (migration 0003)
- precedence `Project > Profile > Global` in the decision service:
  same-slot Profile conflicts resolve by attachment priority, then decision
  priority, then newest revision, then id; the API returns the winning Profile
  decision plus every Profile candidate so conflicts stay visible
- `PUT /v1/projects/:id/decisions` batch upsert/remove in one transaction for
  wizard saves; `GET /v1/global-decisions` for inherited Library rules
- Stack screen shows provenance `Project` / `Profile · <name>` / `Global`, what an
  override shadows and how many other Profiles were shadowed; the editor lists
  every inherited layer

### Compiler 0.3.0

- `DecisionInput.sourceId/sourceName/sourcePriority` feed Profile provenance;
  canonical decisions and shadowed entries carry `origin { id, name, priority }`
- attachment priority ranks before decision priority inside the Profile scope;
  the Recipe layer stays reserved between Project and Profile
- `project.rules` flows into canonical `rules` and renders as
  "## Engineering rules"; adapters print `Source: profile "Fast SaaS"` and
  `Overrides: profile "Design profile" PREFERRED`
- golden snapshots regenerated; new golden coverage for two Profiles with
  different priorities plus a Project override

### Wizard (progressive disclosure, ten steps)

1. basics: name, description, product type, stage, collapsed platforms and
   priorities, Profile selection with priority, AI freedom preset
   (Low / Balanced / High, initializers only)
2. frontend, 3. backend, 4. data, 5. identity & storage, 6. design,
7. AI development, 8. infrastructure: each slot shows what it inherits from
   Profiles or Library rules and offers Inherit/Skip, Locked, Preferred,
   AI decides (with constraint notes) or Disabled with a Library picker
9. rules & references: engineering rules and attached reference Resources
10. review: brief, Profiles, rules, references, explicit decisions grouped by
   mode, inherited decisions with their source, open-slot count and
   client-side conflict warnings (never auto-resolved)

Saving creates or updates the Project (idempotent create) and then applies the
decisions batch; unsaved changes trigger an explicit discard confirmation.

## API

- `GET/POST /v1/profiles`, `GET/PATCH/DELETE /v1/profiles/:id`,
  `POST /v1/profiles/:id/restore`
- `PUT/DELETE /v1/profiles/:id/decisions/:slot`
- `PUT /v1/projects/:id/profiles`
- `PUT /v1/projects/:id/decisions` (batch)
- `GET /v1/global-decisions`
- Project responses now include `profiles[]` and `rules[]`; decision views
  include `profile`, `profiles[]` and `origin`

## Data/config changes

- Migration `0003_quiet_blizzard.sql`: `profiles.archived_at`,
  `projects.rules` (jsonb, default `[]`), index `profiles_owner_type_idx`.
  Applied to the development database and replayed in PGlite and PostgreSQL
  tests.
- Compiler version `0.2.0 → 0.3.0` (semantic additions: origin provenance,
  attachment priority ranking, rules). `examples/generated-context` regenerated.
- No environment changes.

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass — compiler 12, contracts 6, db 2, web 7, api 60 |
| `pnpm build` | pass; new routes `/workspace/profiles`, `/workspace/profiles/[id]` |
| `pnpm test:db` | pass (migration 0003 replayed) |
| `pnpm test:e2e` | pass — 6 journeys (foundation ×2, projects, decisions, context, composer) |

Coverage added:

- compiler: Profile attachment priority beats decision priority, origin
  provenance, rules rendering, regenerated goldens
- `profiles.repository.test.ts` (PGlite): Profile CRUD/archive/restore with owner
  scoping, Profile decision validation and idempotent upsert, Project
  attachment with priorities, deterministic same-slot resolution, override and
  restore of inheritance, priority change flipping the winner, archived Profile
  behavior, batch decisions, compiler input with provenance and rules, two
  Projects sharing Profiles compiling to different hashes
- `profiles.routes.test.ts`: authentication, owner isolation, validation,
  CRUD, decision routes
- `decisions.service.test.ts`: three-layer merge, batch semantics and indexed
  error paths; `projects.service.test.ts`: Profile attachment validation,
  rules normalization
- `e2e/composer.spec.ts`: create a stack Profile with two decisions → Project A
  inherits it with the Balanced preset → Stack shows `Profile · Fast SaaS` →
  compile → Project B reuses the Profile, delegates the database slot with
  constraints and adds a rule → Stack shows the override → compiled hashes
  differ; desktop and mobile overflow checks. Existing journeys updated to the
  ten-step wizard.

## Acceptance criteria

- a user reuses base context across two Projects — composer journey
- every effective choice explains its source — API `source`/`origin`, Stack
  provenance badges, wizard inherited summary, exported `Source:` lines
- same-slot conflicts are deterministic and visible — service/PGlite tests, Stack
  "shadowed" hints, editor layer list
- all four modes remain consistent across scopes — shared `DecisionControl`,
  shared validation in `normalizeDecisionInput`
- full verification gate passes — table above

## Known risks and notes

- Wizard drafts are not persisted before the first save; navigation loss is made
  explicit with a discard confirmation instead.
- The wizard's per-slot picker uses a native select over the active Library
  (up to 100 items); the Stack editor keeps the searchable picker.
- Profile decisions have no compatibility rules yet (V0.3).
- `GET /v1/global-decisions` reads Library rules; editing them still happens in
  the Library on purpose.

Next prompt: prompts/claude-code-production/06_H08A_V0_3_USABILITY.md
