# 24 — Launch Checklist

Checkboxes are evidence gates, not intentions. Only mark an item complete when a
numbered implementation report links passing tests or deployed-environment proof.
The final authoritative decision is `docs/44_V1_LAUNCH_GATE.md`, created by
`prompts/claude-code-production/12_H13_LAUNCH_GATE.md` (reports are offset by
two from the prompt names after reports 39 and 41).

## Product
- [x] onboarding (first-run choices with skip/resume, checklist; `docs/38_V1_PORTABILITY_HANDOFF.md`)
- [x] empty states (Library, Projects, Profiles, Recipes, context, activity)
- [x] sample resources optional (versioned, idempotent, removable)
- [x] import/export (portable JSON with dry run; `docs/38_V1_PORTABILITY_HANDOFF.md`)
- [x] context preview (five targets, canonical JSON, diff)
- [x] copy/download (per file and zipped bundle)
- [x] account deletion (typed e-mail + password, billing revoked first, cascade purge, retryable external state; `docs/42_PRIVACY_ACCOUNT_HANDOFF.md`)

## Engineering
- [x] production env validation (HTTPS origins, secret, trusted proxy; `docs/37_V0_3_RELIABILITY_HANDOFF.md`)
- [x] auth review (security finding table in `docs/37_V0_3_RELIABILITY_HANDOFF.md`)
- [x] ownership tests (cross-user isolation matrix, `apps/api/test/isolation.repository.test.ts`)
- [x] rate limits (process-local; multi-instance store pending)
- [x] migrations (0000–0008 replayed from empty and from the previous migration; run as a release step, never on boot)
- [ ] backups (managed snapshots, encryption and `BACKUP_RETENTION_DAYS` are configured at the hosting provider; provider not chosen, owner blocker — procedure in `docs/13_DEPLOYMENT.md`)
- [x] restore test (`scripts/restore-drill.mjs`: snapshot → migrate scratch → restore → checksums → business reads; evidence in `docs/43_PRODUCTION_OPERATIONS_HANDOFF.md`)
- [x] structured logging (redacted JSON lines with request ids, lifecycle and pool events)
- [x] error monitoring boundary (`SENTRY_DSN` or `ERROR_REPORTING_URL`, content-free reports with release/environment tags; a live DSN is an owner decision)
- [x] analytics (structured product events)
- [x] containers (non-root, health-checked images for API and web; `deploy/compose.staging.yml`; CI `containers` job builds, migrates, smoke-tests and drains them)
- [x] post-deploy smoke check (`scripts/smoke.mjs`: health, readiness, sign-up, authenticated and owner-scoped reads, protected page, anonymous refusal, deletion cleanup)
- [ ] live hosting, managed PostgreSQL, DNS and monitoring accounts (owner blockers; nothing provisioned)

## Legal/basic
- [ ] Terms (draft route `/legal/terms` exists, configuration driven; blocked on owner/legal values and `LEGAL_APPROVED_AT`)
- [ ] Privacy (draft route `/legal/privacy` exists; same blockers)
- [x] subprocessors/AI disclosure (AI processing is off by construction and disclosed in Settings and Privacy; subprocessor list is a placeholder until `LEGAL_SUBPROCESSORS` is set)
- [x] data deletion path (`DELETE /v1/account`, Settings › Gizlilik ve veriler; `docs/42_PRIVACY_ACCOUNT_HANDOFF.md`)

### Legal placeholders that must be supplied before launch
`LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_CONTACT_EMAIL`,
`LEGAL_JURISDICTION`, `LEGAL_EFFECTIVE_DATE`, `LEGAL_SUBPROCESSORS`,
`HOSTING_REGION`, `BACKUP_RETENTION_DAYS`, `BILLING_RECORDS_RETENTION_YEARS`,
`LEGAL_APPROVED_AT`; refund and liability wording (Terms §6/§8) needs legal
review. `GET /v1/legal` reports the missing keys.

## Billing
Launch mode: **free beta** with `BILLING_PROVIDER=none` (owner decision
2026-09-10, gate C1 in `docs/44_V1_LAUNCH_GATE.md`); the upgrade path stays
hidden and no provider account is needed for launch.
- [x] free limits (API-enforced entitlements, `docs/40_BILLING_HANDOFF.md`, `e2e/billing.spec.ts`)
- [x] upgrade (provider-neutral checkout; live provider activation remains an owner decision)
- [x] cancellation (portal, cancel-at-period-end, and revocation at account deletion)
- [x] webhook idempotency (event ids per provider, stale events ignored)
- [x] failed payment handling (`past_due` grace, downgrade, UI warning)

## Growth
- [x] landing page (design-pack screen 01, report 41)
- [ ] 90 sec demo
- [ ] one "Animate UI Toggle" style example
- [ ] one "AI Decide" example
- [ ] one "change stack → context diff" example
