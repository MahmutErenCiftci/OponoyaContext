# 31 — Current-State Audit

Target: Handoff 1A baseline audit before Handoff 4. Performed 2026-09-07 on the
Windows workspace using the local Node 26.8.1 / pnpm 12.3.4 runtime under
`.local/runtime` and the portable PostgreSQL 18.6 cluster on `127.0.0.1:55432`.

## Inspected

- reports `27_FOUNDATION_HANDOFF.md`, `28_AUTHENTICATION_HANDOFF.md` and
  `29_RESOURCE_LIBRARY_HANDOFF.md`;
- `packages/contracts/src/index.ts`, `packages/db/src/schema.ts` and every
  committed migration (`0000_windy_the_hand`, `0001_amazing_supernaut`,
  `0002_sturdy_magik`) plus `drizzle/meta/_journal.json`;
- Fastify `auth` and `resources` modules, `errors.ts`, `config.ts`, `app.ts`;
- Next.js `/auth`, `/workspace`, `/workspace/library` routes and the same-origin
  proxy routes under `apps/web/app/api`;
- root/package scripts, `turbo.json`, `.github/workflows/ci.yml`,
  `playwright.config.ts` and `e2e/foundation.spec.ts`;
- the partial Handoff 4 schema work named in `30_PRODUCTION_EXECUTION_PLAN.md`.

## Findings

1. **Secrets and cookies are redacted.** Fastify logging redacts
   `req.headers.authorization`, `req.headers.cookie` and
   `res.headers.set-cookie`; request logging is disabled; the error handler logs
   only a request ID and category, never the exception message. Covered by
   `apps/api/test/app.test.ts`.
2. **Ownership comes from the session only.** Every Resource route resolves
   `ownerUserId` from `request.currentUser.id`; caller headers such as
   `x-owner-user-id` are ignored and cross-user reads return 404
   (`resources.routes.test.ts`, `resources.service.test.ts`). Tag and
   preference joins are filtered by `tags.ownerUserId` /
   `globalDecisions.ownerUserId`.
3. **URL validation is HTTP/HTTPS only** (`httpUrlSchema` in contracts; covered by
   the contracts and route tests).
4. **Migration history is append-only and replayable.** The development database
   has exactly three `drizzle.__drizzle_migrations` rows matching the journal.
   The PGlite replay test applies the folder twice without data loss; the
   PostgreSQL integration test replays idempotently on the real server.
5. **Migration 0002 is partial Handoff 4 work, not a Project feature.** It adds
   `projects.client_request_id` (unique with `owner_user_id`) and the
   `project_resources` join with cascading foreign keys and a resource index.
   Before Handoff 4 no route, service, repository, UI or test used these tables;
   the `projects` table had zero rows. The migration is applied and valid and
   must not be regenerated.
6. **No regressions found** in authentication or Library paths; nothing had to be
   fixed in completed handoffs.
7. **Workspace note.** `pnpm`/`node` are not on the shell `PATH`; commands run
   through `.local/runtime` as documented in `README.md`.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm typecheck` | pass (5 packages) |
| `pnpm lint` | pass |
| `pnpm test` | pass — contracts 4, db 2, compiler 4, web 6, api 23 |
| `pnpm test:db` | pass against PostgreSQL 18.6 |
| `psql` inspection | 3 applied migrations; `projects` and `project_resources` shaped as in migration 0002; 8 users, 10 resources, 0 projects |

`pnpm build` and `pnpm test:e2e` (including the unchanged foundation journey
covering signup, login, logout, Library create/search/edit/disable/archive/
restore and desktop/mobile overflow checks) were executed in the same session as
part of the Handoff 4 gate; see `32_PROJECTS_HANDOFF.md` for the results.

## Remaining risks

- CI has not run on a hosted runner yet (repository not published).
- The workspace `.env` targets the portable cluster; a fresh checkout uses Docker
  Compose or an existing PostgreSQL as documented.
- Handoff 4 was not implemented by this audit. Implementation followed in the
  same session under its own prompt and report.

Next prompt: prompts/claude-code-production/02_H04_PROJECTS.md
