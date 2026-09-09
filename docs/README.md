# DevContext OS Documentation Guide

This file tells implementation agents how to interpret repository documentation.

## Truth hierarchy

When documents appear to conflict, use this order:

1. current code, committed Drizzle migrations and pinned lockfile for what exists;
2. numbered implementation reports and `30_PRODUCTION_EXECUTION_PLAN.md` for what
   has been verified;
3. ADRs for accepted architecture decisions;
4. product/domain/security specifications for intended behavior;
5. roadmap/backlog for planned work;
6. prompt files for how to execute the next bounded slice.

`MANIFEST.json` describes the original ZIP contents and hashes. It is historical,
not a live implementation inventory, and must never override current filesystem
inspection.

## Required product context

- `00_PRODUCT_VISION.md` — product thesis and positioning
- `01_PRODUCT_SPEC.md` — users, domain objects and major flows
- `03_USER_FLOWS.md` — critical end-to-end behavior
- `05_ROADMAP_VERSIONS.md` — version scope and non-goals
- `08_DATA_MODEL.md` — relational ownership model
- `09_CONTEXT_COMPILER.md` — deterministic precedence/export semantics
- `12_SECURITY_PRIVACY.md` — threat model and privacy requirements
- `22_DOMAIN_RULES.md` — invariants that implementation must preserve
- `23_MVP_ACCEPTANCE_CRITERIA.md` — beta product gate
- `24_LAUNCH_CHECKLIST.md` — production launch areas

## Architecture map

- `apps/web` — Next.js user interface and same-origin API proxy routes
- `apps/web/lib` — server-side API readers, shared labels, slot groups and error helpers
- `apps/web/components` — reusable client components (`DecisionControl`, `ChipField`)
- `apps/api` — Fastify modular monolith
- `apps/api/src/modules/<domain>/routes.ts` — HTTP parsing/status only
- `apps/api/src/modules/<domain>/service.ts` — use cases/domain rules
- `apps/api/src/modules/<domain>/repository.ts` — owner-scoped persistence
- `apps/api/src/lib` — small shared helpers (slugs, rate limiting, log redaction, observability hooks)
- `apps/api/src/modules/audit` and `modules/telemetry` — append-only audit trail and analytics/audit fan-out used by route handlers
- `apps/api/src/modules/recipes`, `modules/samples`, `modules/portability` — Recipes, the optional sample set and portable export/import (Handoff 9)
- `packages/db/src/backup.ts` — logical backup/restore with checksum verification (`pnpm db:backup|db:verify|db:restore`)
- `packages/contracts` — shared Zod request/response contracts
- `packages/db` — Drizzle schema, database construction and migrations;
  `@devcontext/db/testing` provides a PGlite database for repository tests
- `packages/context-compiler` — pure deterministic merge/export behavior
- `e2e` — Playwright critical journeys
- `examples/generated-context` — compiler golden examples

New domain modules must follow route → service → repository → PostgreSQL. Do not
move business rules into React components or Fastify request objects.

## Current implementation state

The durable state is `30_PRODUCTION_EXECUTION_PLAN.md`. Completed work has reports:

- `27_FOUNDATION_HANDOFF.md`
- `28_AUTHENTICATION_HANDOFF.md`
- `29_RESOURCE_LIBRARY_HANDOFF.md`
- `31_CURRENT_STATE_AUDIT.md`
- `32_PROJECTS_HANDOFF.md`
- `33_DECISIONS_HANDOFF.md`
- `34_COMPILER_EXPORTS_HANDOFF.md`
- `35_COMPOSER_HANDOFF.md`
- `36_V0_3_USABILITY_HANDOFF.md`
- `37_V0_3_RELIABILITY_HANDOFF.md`
- `38_V1_PORTABILITY_HANDOFF.md`
- `39_TECHNOLOGY_CATALOG_HANDOFF.md`
- `40_BILLING_HANDOFF.md`
- `41_HYBRID_UI_HANDOFF.md` (design-pack UI integration; later reports shift by one more)
- `42_PRIVACY_ACCOUNT_HANDOFF.md`
- `43_PRODUCTION_OPERATIONS_HANDOFF.md`
- `44_V1_LAUNCH_GATE.md` — decision **BLOCKED** (2026-09-09)

Every implementation handoff (1–12) has a report. The launch gate found no
code defect but is blocked on owner-only items: hosting, managed PostgreSQL,
DNS/TLS, a monitoring destination, publishing the repository so CI runs on a
hosted runner, and legal values and approval. The launch mode is a free beta
(`BILLING_PROVIDER=none`, owner decision 2026-09-10). The product must not be
called production-ready until the gate is re-run with staging evidence and
returns GO.

## Prompt execution

Use `../prompts/claude-code-production/README.md`. Run one prompt at a time and
create its required implementation report. A plan or table existing in docs does
not mean its code is implemented.

## Commands

```text
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:db
pnpm test:e2e
pnpm db:backup
pnpm db:verify --file backups/<name>.json
pnpm db:restore --file backups/<name>.json --yes
```

On this Windows workspace, when `pnpm` is not on PATH use
`.\.local\runtime\pnpm.cmd` from the repository root (or
`.\scripts\pnpm-local.ps1`), which also puts the matching Node binary first.
When Windows App Control blocks the native pnpm binary, `.local/runtime/pnpm.cmd`
routes `pnpm run|exec|--filter|-r` through the Node stand-in
`.local/runtime/pnpm-shim.mjs` (installs still need the real pnpm, kept as
`pnpm-native.cmd`).

## Documentation update rules

- Never check off planned work before tests and acceptance evidence pass.
- Implementation reports describe delivered behavior, migrations/config changes,
  verification results, risks and the exact next prompt.
- Update API docs when route behavior changes.
- Update data-model docs with schema semantics, not generated SQL duplication.
- Add an ADR only for material architecture decisions, not ordinary feature work.
- Never put credentials, session cookies, private Resource content or production
  connection strings in reports.
