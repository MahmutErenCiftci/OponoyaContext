# 25 — Recommended Codex / Claude Handoff Sequence

Do not give one giant "build everything" prompt.

## Handoff 1 — Foundation hardening
Prompt:
Use `prompts/CODEX_MASTER_PROMPT.md`, then implement V0.0 foundation gaps:
- working DB migration
- API error handler
- environment validation
- CI
- lint tooling
- test runner
Do not implement product features yet.

## Handoff 2 — Authentication
Implement the auth vertical slice.
Acceptance:
- signup/login/logout
- protected web shell
- API resolves current user
- remove development owner ID
- ownership test

## Handoff 3 — Resource Library
Implement Resource CRUD + tags + preferences.

## Handoff 4 — Projects
Project CRUD + wizard storage model.

## Handoff 5 — Decisions
Build the DecisionControl API/model and UI.

## Handoff 6 — Compiler
Wire DB inputs into `@devcontext/context-compiler`, persist context versions and create exports.

## Handoff 7 — V0.2 Composer and Profiles
Full progressive Project Wizard, Stack/Design/AI/Deployment Profiles, reusable
presets, inheritance/provenance and review UX. Full Recipes remain V1.0 scope.

## Handoff 8A — V0.3 usability
Global search, favorites, duplicate detection, compatibility warnings, clone,
semantic context diff and onboarding.

## Handoff 8B — V0.3 beta hardening
Security review, isolation matrix, rate limits, audit/analytics, error states and
backup/restore proof.

## Handoff 9 — V1 Recipes, activation and portability
Recipes, optional samples, safe transactional import, structured data export and
compiled context file downloads.

## Handoff 10 — Billing and entitlements
Provider-neutral Free/Pro limits, secure idempotent provider boundary and billing
UX. Provider activation requires an explicit owner/provider decision.

## Handoff 11 — Privacy and account lifecycle
User data export, complete account deletion, integration revocation and legally
reviewable Terms/Privacy surfaces.

## Handoff 12 — Production operations
Reproducible containers, isolated environments, CI/CD, monitoring, migrations,
rollback, backup/restore and operator runbooks.

## Handoff 13 — Launch gate
Evidence-based product, security, data, commercial/legal and operations GO/NO-GO
review. Missing external evidence is BLOCKED, never PASS.

After V0.3, reassess before Discover/AI. Discover and AI remain post-launch roadmap
work unless the product owner explicitly changes scope.

Claude Code execution details live in `prompts/claude-code-production/README.md`.
Run exactly one numbered prompt at a time.
