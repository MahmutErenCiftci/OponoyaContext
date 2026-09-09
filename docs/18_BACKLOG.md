# 18 — Build Backlog

## P0 — Foundation
- [x] wire Next.js → API client (health contract + unavailable state)
- [x] wire Better Auth to API + DB
- [x] create migration pipeline (committed SQL + metadata + replay tests)
- [x] implement request auth decorator
- [x] define error envelope
- [x] CI workflow (configured; hosted run awaits repository publication)
- [x] environment validation and root .env loading
- [x] real lint/test/typecheck/build commands
- [x] compiled ESM packages and API startup

Handoff 1 implementation: `docs/27_FOUNDATION_HANDOFF.md`.
Authentication was completed in Handoff 2; the unauthenticated starter project write remains removed.

Handoff 2 implementation: `docs/28_AUTHENTICATION_HANDOFF.md`.

## P0 — V0.1 Library
- [x] resource CRUD
- [x] tags
- [x] search/filter
- [x] global preference decision
- [x] archive/restore
- [x] ownership tests

Handoff 3 implementation: `docs/29_RESOURCE_LIBRARY_HANDOFF.md`.

## P0 — V0.1 Minimal Projects
- [x] project CRUD with archive/restore
- [x] idempotent create (`Idempotency-Key` / `clientRequestId`)
- [x] wizard forms (brief, stage/platforms/priorities, Library resources, review)
- [x] manual Library Resource attachment with owner/active validation
- [x] project overview route and real dashboard counts
- [x] ownership, attachment and Playwright journey tests

Handoff 4 implementation: `docs/32_PROJECTS_HANDOFF.md`.

## P0 — V0.2 Project Composer
- [x] project decisions (Handoff 5: `docs/33_DECISIONS_HANDOFF.md`)
- [x] DecisionControl component and Project Stack screen
- [x] profiles (stack/design/ai/deployment) with decisions and archive
- [x] project profile attachments with priority and deterministic conflicts
- [x] inheritance preview (wizard inherited summary, Stack provenance)
- [x] review step with locked/preferred/delegated/disabled summary
- [x] AI freedom presets (initializers only)
- [x] ten-step progressive wizard with engineering rules

Handoff 7 implementation: `docs/35_COMPOSER_HANDOFF.md`.

## P0 — Compiler
- [x] query all input scopes (global + project now; profile/recipe wired as empty inputs)
- [x] pure merge engine
- [x] provenance
- [x] warnings (unresolved, archived, conflict, disabled attachment)
- [x] version hashing
- [x] persistence (`context_versions`, duplicate suppression, row lock)
- [x] generic export
- [x] AGENTS export
- [x] CLAUDE export
- [x] Cursor export
- [x] Copilot export
- [x] Context screen with previews, copy/download, version and export history

Handoff 6 implementation: `docs/34_COMPILER_EXPORTS_HANDOFF.md`.

## P1 — UX
- [x] command palette (workspace search + quick actions)
- [x] duplicate detection (normalized URL and name, evidence, non-blocking)
- [x] project cloning (idempotent, complete copy)
- [x] save as profile (save as recipe arrives with recipes in Handoff 9)
- [x] context diff (semantic)
- [x] favorites and saved views
- [x] onboarding checklist
- [x] compatibility rules with impact warnings

Handoff 8A implementation: `docs/36_V0_3_USABILITY_HANDOFF.md`.

## P0 — V1 activation and portability
- [x] Recipe CRUD, decisions and profile attachments (Handoff 9)
- [x] apply a Recipe by reference with Project > Recipe > Profile > Global precedence
- [x] save Project as Recipe
- [x] first-run choices with skip/resume and settings controls
- [x] optional, versioned, removable sample data
- [x] portable JSON export (no secrets) and validated dry-run import with skip/copy/replace
- [x] zipped context bundle with manifest and canonical JSON
- [x] settings/help surfaces (canonical context, version history, decision modes)

Handoff 9 implementation: `docs/38_V1_PORTABILITY_HANDOFF.md`.

## P0 — Technology catalog and appearance (report 39)
- [x] `@devcontext/catalog` compiled from `data/catalog` with validation
- [x] catalog API, Library bridge, stack preset → PREFERRED stack Profile
- [x] Catalog screens with brand marks (Simple Icons) and editor-assessment labels
- [x] Library and landing marks, monogram fallback
- [x] light theme via tokens, persisted preference, Settings → Appearance
- [ ] P2: automatic "avoid" rules from `aiPitfalls` in compiled context
- [ ] P2: stack-specific launch checklist from `productionGaps`
- [ ] P2: Türkiye bureaucratic-timeline warnings when composing a project
- [ ] P2: live npm / GitHub / PyPI metrics via weekly job (never stored in the catalog)
- [ ] P2: logos for the 52 entries without a Simple Icons mark

## P0 — V1 billing and entitlements (Handoff 10)
- [x] centralized plans, limits and features; enforcement in the API layer on create, restore, clone, import, export, bundle and diff
- [x] `subscriptions` and `billing_events` (migration 0007) without card data
- [x] provider-neutral adapter contract, raw-body signature verification, idempotent and order-safe webhook processing, reconcile path
- [x] fake/test provider with in-app checkout and portal pages delivering signed webhooks
- [x] Plan page: current plan, usage meters, honest Free/Pro comparison, upgrade/manage/return states
- [ ] BLOCKED (owner): choose payment provider, legal billing entity/region, tax handling and the Pro price; implement the real adapter and register the webhook
- [ ] P2: transactional limit check inside the create transaction (currently checked before the write)

## P1 — Production
- [x] rate limit (process-local buckets, Handoff 8B)
- [x] structured logging (request/security/analytics/error lines with redaction)
- [x] error reporting boundary (Sentry store endpoint or JSON webhook, content-free; live DSN is an owner decision — `docs/43_PRODUCTION_OPERATIONS_HANDOFF.md`)
- [x] analytics (privacy-conscious structured events)
- [x] audit trail (append-only `audit_events`, `GET /v1/audit`, overview activity card)
- [x] account deletion (`docs/42_PRIVACY_ACCOUNT_HANDOFF.md`)
- [x] data export (portable JSON plus account-level export)
- [x] backups/restore drill (logical snapshot with checksum verification, `scripts/restore-drill.mjs`; managed production snapshots await the hosting decision)
- [x] containers, environments, smoke check and runbooks (`docs/43_PRODUCTION_OPERATIONS_HANDOFF.md`)

Handoff 8B implementation: `docs/37_V0_3_RELIABILITY_HANDOFF.md`.

## P1 — Product UI
- [x] design-pack integration: 27 reference screens, light-first tokens, top navigation, drawers, four-step wizard, Turkish copy
- [x] shared components (`apps/web/components`) and label helpers reused by every screen
- [x] 1440 / 1024 / 390 px checks with no horizontal overflow; dark and mobile as adaptations
- [ ] Safari / Firefox pass (launch gate)

UI integration report: `docs/41_HYBRID_UI_HANDOFF.md`.

## P2
- [ ] GitHub integration
- [ ] resource URL enrichment
- [ ] Discover
- [ ] AI recommendations
- [ ] browser extension
- [ ] CLI
- [ ] team workspaces

## Agent rule

Coding agents should take one vertical slice at a time. Do not "complete the whole backlog" in one unattended change.
