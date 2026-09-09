# Handoff 1A — Current-State Audit

Use this after `00_SESSION_BOOTSTRAP.md`. This is a verification handoff, not a
feature implementation handoff.

## Objective

Establish an evidence-backed baseline for completed V0.0 foundation,
authentication and Resource Library work before continuing Handoff 4.

## Inspect

- implementation reports 27, 28 and 29;
- shared contracts, Drizzle schema and every committed migration;
- Fastify auth/resource modules and ownership boundaries;
- protected Next.js workspace, auth and Library routes;
- package scripts, CI and Playwright configuration;
- the partial Handoff 4 work described in `docs/30_PRODUCTION_EXECUTION_PLAN.md`.

## Required checks

1. Confirm secrets and raw cookies are redacted from logs.
2. Confirm all Resource queries and mutations derive `ownerUserId` from the
   authenticated session and cross-user IDs return 404/empty results.
3. Confirm only HTTP/HTTPS Resource URLs are accepted.
4. Replay migrations in an isolated engine and the configured development/test
   PostgreSQL database.
5. Exercise signup, login, logout, Library create/search/edit/preference/archive/
   restore and responsive layouts.
6. Review migration `0002_sturdy_magik.sql` as partial Handoff 4 work. Do not
   claim Projects are implemented merely because its tables exist.

Fix only regressions in already completed handoffs. Do not implement Project
features in this audit.

## Acceptance criteria

- lint, typecheck, unit tests, build, PostgreSQL integration and E2E pass;
- no Critical/High regression in completed authentication or Library paths;
- migration history is append-only and replayable;
- the current-state ledger accurately separates complete and partial work;
- changed UI has desktop/mobile evidence if a regression fix was necessary.

## Deliverable

Create `docs/31_CURRENT_STATE_AUDIT.md` containing inspected evidence, commands
and results, regressions fixed, remaining risks and the exact statement:

`Next prompt: prompts/claude-code-production/02_H04_PROJECTS.md`

Do not check off Handoff 4.
