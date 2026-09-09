# 43 — Production Operations and Deployment Handoff

Target: V1.0 / Handoff 12 (`prompts/claude-code-production/11_H12_PRODUCTION_OPERATIONS.md`),
delivered on 2026-09-09 after `42_PRIVACY_ACCOUNT_HANDOFF.md`. The prompt names
this report `41_PRODUCTION_OPERATIONS_HANDOFF.md`; reports 39 and 41 were taken
by the catalog and UI slices, so the launch gate becomes `44_V1_LAUNCH_GATE.md`.

## Decision gate

No hosting provider, managed PostgreSQL, DNS, monitoring account or domain has
been chosen by the owner. Following the prompt, this slice ships portable
containers, provider-neutral configuration, a preview/staging stack, a smoke
check, a restore drill and runbooks, and records live provisioning as an
external blocker. Nothing was provisioned and no credential exists. Docker
image builds were deferred on this Windows workstation by owner instruction
("docker kalsın şimdilik", 2026-09-09); the CI `containers` job builds, runs and
smoke-tests the images on every push and is the evidence path until then.
Slice tests are deferred by the same owner decision as Handoff 11; the existing
suites stay green.

## Delivered

### 1. Build and runtime
- `apps/api/Dockerfile`, `apps/web/Dockerfile` (multi-stage on
  `node:26.8.1-bookworm-slim`, the pinned runtime; `pnpm@12.3.4` from the
  lockfile; `pnpm deploy --prod` for the API, Next.js `output: "standalone"`
  with `outputFileTracingRoot` for the web; non-root `app` user; `HEALTHCHECK`
  against `/health` and `/api/health`; migrations are a separate command, never
  a boot step). `.dockerignore` keeps `.env*`, `.local`, tests, docs, e2e,
  scripts and build outputs out of the context; `files` fields on the
  workspace packages limit what `pnpm deploy` copies to `dist` (and `drizzle`).
- API lifecycle (`apps/api/src/server.ts`): startup log with `APP_ENV`,
  `RELEASE`, Node version and the reporting target; SIGTERM/SIGINT flip
  `app.readiness.draining`, close the server and the pool, and exit 1 after
  `SHUTDOWN_TIMEOUT_MS`; unhandled rejections are summarised and reported.
  `/health` = process alive (+ environment/release), `/ready` = `SELECT 1` and
  not draining (503 "Shutting down" otherwise); neither leaks connection data.
- Bounded pool (`packages/db/src/index.ts`): `DATABASE_POOL_MAX`,
  `DATABASE_STATEMENT_TIMEOUT_MS` (server and client side), idle timeout, and
  `stats()` for the watchdog that logs `database_pool_pressure` when requests
  queue or the pool is full.
- Web: `/api/health` liveness route; standalone server for the image.

### 2. Configuration and security
- New validated variables (`apps/api/src/config.ts`): `APP_ENV`
  (development/test/preview/staging/production, defaults to NODE_ENV),
  `RELEASE`, `SENTRY_DSN`, `ERROR_REPORTING_URL`, `ERROR_REPORTING_TOKEN`,
  `DATABASE_POOL_MAX`, `DATABASE_STATEMENT_TIMEOUT_MS`, `SHUTDOWN_TIMEOUT_MS`,
  `INSECURE_HTTP_ORIGINS`. Production builds refuse a missing or local
  development `BETTER_AUTH_SECRET`, non-HTTPS origins (unless
  `INSECURE_HTTP_ORIGINS=true` on a non-production `APP_ENV`), the fake billing
  provider on `APP_ENV=production` and `INSECURE_HTTP_ORIGINS` on production.
  Errors list variable names only.
- `deploy/env/production.env.example`, `deploy/env/staging.env.example` (copy
  to git-ignored `deploy/env/<env>.env`) and the committed throwaway
  `deploy/env/ci.env`; secret generation, storage, rotation and rollback are in
  `docs/13_DEPLOYMENT.md`.
- Existing CSP/security headers remain; the smoke check asserts
  `frame-ancestors 'none'` on the landing page. `scripts/verify-bundle.mjs`
  fails the build when a browser chunk contains a server-only variable name or
  a connection string, or the standalone output carries an `.env` file.

### 3. Delivery pipeline
- `.github/workflows/ci.yml`: the existing `verify` job now runs the bundle
  guard after `pnpm build`; a new `containers` job builds both images, starts
  `deploy/compose.staging.yml` with `deploy/env/ci.env` (own PostgreSQL,
  `migrate` one-shot before `api`, `web` after `api` is healthy), runs
  `scripts/smoke.mjs`, stops the API and asserts the
  `shutdown_started`/`shutdown_complete` lifecycle lines, uploads logs on
  failure and tears the stack down with its volumes.
- Migration and release order, forward-fix policy and application rollback are
  documented in `docs/13_DEPLOYMENT.md`; the schema is never mutated on boot.

### 4. Observability and recovery
- `apps/api/src/lib/error-reporter.ts`: provider-neutral reporter used by the
  error handler for 5xx and by the unhandled-rejection hook. Sentry is spoken
  through its store endpoint without an SDK (no dependency could be added on
  this workstation and nothing must instrument requests by accident); a JSON
  webhook is the alternative. Payloads: class, code, constraint, fingerprint,
  frames, request id, route, status, `APP_ENV`, `RELEASE`. Rate limited (60 per
  minute, 10 s per fingerprint), transport failures logged once a minute.
- Alert definitions (availability, error rate, latency, pool pressure,
  webhook failures, backup failures, blocked deletions) and the backup policy
  (managed snapshots, encryption, `BACKUP_RETENTION_DAYS`, snapshot before each
  migration) are in `docs/13_DEPLOYMENT.md`.
- `scripts/restore-drill.mjs`: snapshot the source with the repository's
  logical format, migrate and restore a scratch database, verify every table
  checksum, compare business reads on both sides, write evidence JSON.
- `scripts/smoke.mjs`: post-deploy check (health, readiness, web liveness,
  landing + CSP, sign-up, `/v1/me`, `/v1/workspace/summary`, protected
  `/workspace`, anonymous refusal, deletion of the throwaway account).
- `pnpm db:retention --years N [--dry-run]` (`packages/db/src/retention-cli.ts`)
  purges completed `account_deletions` rows past the billing-record retention.
- Runbooks for deploy, migration, rollback, restore, auth outage, payment
  webhook backlog and data-deletion retry: `docs/13_DEPLOYMENT.md`.

## Verification

| Check | Result (2026-09-09) |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` (all packages, scripts, e2e) | pass |
| `pnpm test` | pass after adapting two existing assertions to the extended `/health` payload (contracts strip unknown keys; the web parser is unaffected) |
| `pnpm build` + `scripts/verify-bundle.mjs` | pass; browser chunks contain no server-only names or connection strings, standalone output has no `.env` |
| `pnpm test:db`, `pnpm test:e2e` | see the gate line below |
| Config-failure test (production build, no secret, HTTP origins) | refused at startup: "Invalid environment variables: BETTER_AUTH_SECRET, BETTER_AUTH_URL, CORS_ORIGIN" (names only) |
| `scripts/smoke.mjs` against the development servers | 10/10 steps pass (sign-up → reads → protected page → 401 without cookie → deletion cleanup) |
| `scripts/restore-drill.mjs` against a scratch database on the local cluster | passed in 961 ms: 9 migrations, 27 tables, all checksums match, business reads equal on both sides (123 users, 302 resources, 106 projects, 73 context versions); evidence `backups/restore-drill-2026-09-09.json` (git-ignored) |
| Image build, shutdown drain and readiness 503 | deferred locally (owner); exercised by the CI `containers` job (`docker compose … stop api` must log the lifecycle lines) — not yet evidenced on a hosted runner because the repository is not published |
| Staging migration/rollback compatibility | procedure documented; no staging environment exists (owner blocker) |

## Launch blockers carried to the gate

- Hosting, managed PostgreSQL (backups, encryption, retention), DNS/TLS and a
  monitoring destination (`SENTRY_DSN` or webhook) are owner decisions; none is
  provisioned.
- Repository not published: the CI pipeline (including the container job) has
  never run on a hosted runner.
- Legal values and approval (report 42), real billing provider (report 40).
- Rate limits are process-local; a multi-instance deployment needs a shared
  store before limits are global (documented since Handoff 8B).

## Files

- Runtime: `apps/api/src/{server,app,config,errors}.ts`,
  `apps/api/src/lib/error-reporter.ts`, `apps/api/src/modules/health/routes.ts`,
  `packages/db/src/{index,retention-cli}.ts`, `packages/db/package.json`,
  `apps/web/next.config.ts`, `apps/web/app/api/health/route.ts`.
- Delivery: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`,
  `deploy/compose.staging.yml`, `deploy/env/*.env.example`, `deploy/env/ci.env`,
  `.github/workflows/ci.yml`, `scripts/{smoke,restore-drill,verify-bundle}.mjs`,
  root `package.json` scripts (`smoke`, `restore:drill`, `verify:bundle`,
  `db:retention`), `files` fields in the workspace packages, `.gitignore`,
  `.env.example`.
- Docs: this report, `13_DEPLOYMENT.md`, `12_SECURITY_PRIVACY.md`,
  `24_LAUNCH_CHECKLIST.md`, `18_BACKLOG.md`, `30_PRODUCTION_EXECUTION_PLAN.md`,
  `README.md`, `CLAUDE.md`.

Next prompt: prompts/claude-code-production/12_H13_LAUNCH_GATE.md
