# 30 — Production Execution Plan

This is the durable progress ledger for implementation agents. Update it only
when the corresponding acceptance criteria have passed.

## Current repository state

- [x] Handoff 1 — V0.0 foundation hardening (`docs/27_FOUNDATION_HANDOFF.md`)
- [x] Handoff 2 — authentication (`docs/28_AUTHENTICATION_HANDOFF.md`)
- [x] Handoff 3 — Resource Library (`docs/29_RESOURCE_LIBRARY_HANDOFF.md`)
- [x] Handoff 1A — current-state audit (`docs/31_CURRENT_STATE_AUDIT.md`)
- [x] Handoff 4 — Projects (`docs/32_PROJECTS_HANDOFF.md`)
- [x] Handoff 5 — Decisions (`docs/33_DECISIONS_HANDOFF.md`)
- [x] Handoff 6 — Compiler and exports (`docs/34_COMPILER_EXPORTS_HANDOFF.md`)
- [x] Handoff 7 — V0.2 composer and profiles (`docs/35_COMPOSER_HANDOFF.md`)
- [x] Handoff 8A — V0.3 usability and explainability (`docs/36_V0_3_USABILITY_HANDOFF.md`)
- [x] Handoff 8B — V0.3 reliability and security beta (`docs/37_V0_3_RELIABILITY_HANDOFF.md`)
- [x] Handoff 9 — V1 recipes, activation, import and export (`docs/38_V1_PORTABILITY_HANDOFF.md`)
- [x] Handoff 10 — billing and entitlements (`docs/40_BILLING_HANDOFF.md`; live provider activation remains an external blocker)
- [x] Design-pack UI integration — 27 reference screens, light-first design system, Turkish copy, rewritten e2e journeys (`docs/41_HYBRID_UI_HANDOFF.md`)
- [x] Handoff 11 — privacy, deletion and legal launch surfaces (`docs/42_PRIVACY_ACCOUNT_HANDOFF.md`; legal values and approval remain owner blockers, slice tests deferred by owner)
- [x] Handoff 12 — production operations and deployment (`docs/43_PRODUCTION_OPERATIONS_HANDOFF.md`; hosting, managed PostgreSQL, DNS and monitoring accounts remain owner blockers, local image builds deferred by owner)
- [ ] Handoff 13 — launch gate: reviewed 2026-09-09, decision **BLOCKED** (`docs/44_V1_LAUNCH_GATE.md`; no code defect found, blocked on hosting/database/DNS/monitoring provisioning, repository publication for hosted CI, legal values and approval). Billing mode decided 2026-09-10: free beta, `BILLING_PROVIDER=none` (gate C1 PASS). Not production-ready until the gate is re-run with staging evidence and returns GO.

## Migration state

Migrations `0000`–`0008` are committed, applied to the development database and
replayable (PGlite replay from empty and from the previous migration, PostgreSQL
integration test). `0002` added
`projects.client_request_id` and `project_resources` (Handoff 4); `0003` added
`profiles.archived_at`, `projects.rules` and a profile type index (Handoff 7);
`0004` added `resources.favorite`, `compatibility_rules` and `lower(name)` search
indexes (Handoff 8A); `0005` added the append-only `audit_events` table
(Handoff 8B); `0006` added `projects.recipe_id`, `recipes.archived_at`,
`workspace_settings`, `workspace_samples` and `import_requests` (Handoff 9);
`0007` added `subscriptions` and `billing_events` (Handoff 10); `0008` added
the `account_deletions` ledger without a foreign key to `users` (Handoff 11).
Never regenerate or delete an applied migration; add forward migrations
instead.

## Handoff 13 starting point

Handoff 12 delivered non-root health-checked images for API and web, the
preview/staging Compose stack with migrations as a release step, validated
deployment configuration (`APP_ENV`, `RELEASE`, pool and shutdown bounds,
HTTPS enforcement with an explicit preview escape hatch), the provider-neutral
error reporter (Sentry store endpoint or JSON webhook), the post-deploy smoke
check, the backup → restore drill, the deletion-ledger retention job, the CI
`containers` job and the operator runbooks (report 43). The launch gate must
weigh the remaining owner blockers: hosting/managed PostgreSQL/DNS/monitoring
not provisioned, repository not published (CI never ran on a hosted runner),
legal values and approval (report 42), real billing provider (report 40),
process-local rate limits for a single instance, and the owner's decision to
write the slice tests for Handoffs 11–12 after the product is complete.

## Handoff 12 starting point (historical)

Handoff 11 delivered account export (`GET /v1/account/export`), deliberate
deletion with billing revocation and cascade purge (`DELETE /v1/account`), the
Settings privacy section and configuration-driven Terms/Privacy drafts
(report 42). Owner blockers carried into Handoff 12: legal values and
`LEGAL_APPROVED_AT`, the real billing provider, and a scheduled purge of
completed `account_deletions` rows after `BILLING_RECORDS_RETENTION_YEARS`.

## Handoff 11 starting point (historical)

V0.3 and the V1 activation slice are complete: Recipes with
Project > Recipe > Profile > Global inheritance, first-run choices with
skip/resume, versioned removable sample data, portable JSON export/import with
dry run and explicit duplicate strategies, and zipped context bundles
(Handoff 9), the technology catalog with brand marks and the light theme
(report 39), and Free/Pro entitlements with a provider-neutral billing boundary
and a signed-webhook test provider (Handoff 10, report 40; the real provider,
price and legal entity are owner decisions and remain blocked). The web app now
implements the 27-screen design pack (report 41): light-first tokens, top
navigation, right-hand drawers, the four-step wizard and shared components in
`apps/web/components`; new surfaces must reuse them. Not yet built:
account deletion and integration revocation, legal surfaces, Sentry wiring,
containers and managed backups. The compiler is at 0.4.1; a semantic change must bump
`COMPILER_VERSION` and regenerate goldens plus `examples/generated-context`.

## Production sequence

Run prompts from `prompts/claude-code-production/` in numeric order. Each prompt
is a separate vertical slice and must produce a numbered implementation report.

## Global stop conditions

An agent must stop and report a blocker instead of inventing values when work
requires:

- production provider credentials or account access;
- a payment-provider/legal-entity choice not supplied by the owner;
- DNS or domain ownership changes;
- approval of Terms, Privacy Policy or tax/legal claims;
- destructive production data operations;
- a material architecture change outside the documented modular monolith.

Code can still be prepared behind interfaces and validated in test mode while an
external dependency remains blocked. A blocker is not permission to skip tests or
mark the launch gate complete.
