# 13 — Deployment Plan

## Environments

- local
- preview/staging
- production

Never point preview deployments at production database.

## Local

Docker:
- PostgreSQL

Processes:
- Next.js web
- Fastify API

## Production MVP

Recommended shape:

```text
Cloudflare DNS/WAF
     |
     +--> Web deployment
     |
     +--> API deployment
                |
                v
        Managed PostgreSQL
```

## Why managed PostgreSQL

The product itself is about developer productivity. Do not spend early-stage engineering time maintaining production database backups, replication and failover unless required by budget/geography.

## Docker API

API should build as a small image using the repository-pinned Node 26.8.1 runtime.
Keep the image runtime aligned with `.node-version`, `package.json` and
`docs/26_SOURCES_AND_VERSION_NOTES.md`.

## Migration strategy

- migrations generated in repository
- migration review in PR
- run migration as release step
- app should not auto-generate schema mutations on boot
- backwards-compatible schema changes where possible

## CI pipeline

On pull request:
1. install
2. lint
3. typecheck
4. unit/integration tests
5. build
6. migration consistency check

On main:
- deploy staging/production depending workflow
- run migration before new code when safe

## Rollback

Application:
- redeploy previous artifact

Database:
- prefer forward-fix migrations
- destructive schema changes require staged rollout and backup

## Runtime configuration (Handoff 8B)

- Production refuses to start unless `BETTER_AUTH_URL` and `CORS_ORIGIN` are
  HTTPS origins and `BETTER_AUTH_SECRET` is set; session cookies are only
  marked Secure for HTTPS base URLs.
- `TRUST_PROXY` (report 45): `false` uses the socket address; `true` trusts
  only private-network peers (loopback, link-local, RFC 1918 / unique-local,
  i.e. a platform load balancer); anything else is an explicit list of IPs or
  CIDR ranges. A client on the internet can never choose its own address.
- `WEB_PROXY_SECRET` (≥ 32 characters, required when `APP_ENV=production`)
  must hold the same value on the API and the web service. The web proxy drops
  every client-sent forwarding header and presents the end-user address it
  resolved together with the secret; the API uses that address for anonymous
  rate limits (sign-in, sign-up) and Better Auth. Without it every anonymous
  request shares the web server's bucket (the web logs
  `web_proxy_secret_missing` once in production).
- Rate limits are process-local. One API instance is the V0.3 deployment shape;
  scaling to several instances requires a shared store before the limits are
  global (documented, not built).
- Logs are JSON lines: one `category: "http"` line per request (route pattern,
  status, duration, request id, user id), `category: "security"` warnings for
  401/403/413/429 and rejected auth calls, `category: "analytics"` product
  events and `category: "unexpected_error"` summaries (error class, driver code,
  constraint, fingerprint, stack frames; the redacted message only at debug).
  Ship them to the log platform of the hosting provider; no SDK is bundled.

## Billing configuration and webhook runbook (Handoff 10)

- `BILLING_PROVIDER=none` (default) keeps every account on the Free plan with no
  upgrade path; the product is fully usable. `fake` is the in-process test
  provider for development, Playwright and demos and is refused in production.
  `stripe` is reserved for the real adapter and is refused until it ships.
- With a provider: set `BILLING_WEBHOOK_SECRET` (≥ 32 random characters),
  `BILLING_SECRET_KEY`, `BILLING_PRO_PRICE_ID` and `BILLING_PRO_PRICE_LABEL` on
  the API only; register `https://<api-host>/v1/billing/webhook` with the
  provider. Secrets are never logged; the web app has no access to them (test).
- Delayed or reordered events: entitlements are derived at read time, a late
  renewal keeps Pro for 3 days and a failed renewal for 7 days, older events are
  ignored and duplicates answer without changes. Recovery for a missed event: the
  user (or an operator through the user's session) calls
  `POST /v1/billing/reconcile`, which re-reads the provider and overwrites local
  state; the Plan page does this automatically after a checkout return.
- Inspection: `billing_events` lists every received event with its processing
  status; `subscriptions` is one row per user. Neither table stores card data.

## Backup and restore

Managed PostgreSQL snapshots remain the production backup (configured in
Handoff 12). The repository also ships a logical, verifiable drill that works
against any PostgreSQL and is exercised in CI on every run:

```text
pnpm db:backup  [--out backups/name.json] [--url postgresql://…]
pnpm db:verify  --file backups/name.json  [--url …]
pnpm db:restore --file backups/name.json --yes [--url …]
```

The snapshot stores every public table as exact text plus per-table row counts
and content hashes and the applied migration hashes. Restore refuses a target
whose migrations differ, replaces every table inside one transaction and only
commits when the recomputed checksums match. Never point `--url` at a
production database without a fresh managed snapshot first.

Snapshots contain password hashes and session tokens. `pnpm db:backup` writes
them owner-only (`0600`, directory `0700` on POSIX); keep `backups/` out of
shared folders and delete drill snapshots after use.

## Production readiness checklist

- HTTPS
- secure auth cookies
- CORS exact origin
- DB backup enabled
- error monitoring
- structured logs
- health/readiness endpoint
- rate limiting
- email/provider failure handling
- billing webhook signature verification when billing exists

## Legal configuration and account deletion runbook (Handoff 11)

- Optional environment variables drive the Terms and Privacy pages:
  `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_CONTACT_EMAIL`,
  `LEGAL_JURISDICTION`, `LEGAL_EFFECTIVE_DATE` (ISO date),
  `LEGAL_APPROVED_AT` (ISO date, set only after owner/legal review),
  `LEGAL_SUBPROCESSORS` (comma-separated), `HOSTING_REGION`,
  `BACKUP_RETENTION_DAYS`, `BILLING_RECORDS_RETENTION_YEARS`. While any of
  them is unset the pages show `belirlenmedi: <KEY>` and a draft banner;
  `GET /v1/legal` lists the missing keys under `missing`. Never fill them with
  guesses.
- Account deletion is self-service (Settings › Gizlilik ve veriler). A
  blocked deletion (409 `billing_provider_unavailable` /
  `billing_provider_not_configured`) leaves a `pending_external` row in
  `account_deletions`; the user retries from Settings. Operators can list
  pending rows with
  `SELECT user_id, status, attempts, last_error, last_attempt_at FROM account_deletions WHERE status <> 'completed';`
  and must restore provider connectivity (or configure the provider the row
  names) rather than deleting rows by hand.
- Completed rows are the minimal billing record; keep them for
  `BILLING_RECORDS_RETENTION_YEARS` and purge with a scheduled job that is part
  of Handoff 12.

## Containers, environments and runbooks (Handoff 12)

### Images
- `apps/api/Dockerfile` and `apps/web/Dockerfile` build from the repository
  root on `node:26.8.1-bookworm-slim` (the pinned runtime), install with the
  frozen lockfile through `pnpm@12.3.4`, build the workspace, and produce a
  pruned production copy (`pnpm deploy --prod` for the API, Next.js standalone
  output for the web). Both run as the non-root `app` user, expose one port,
  declare a `HEALTHCHECK` against `/health` (API) or `/api/health` (web) and
  never contain `.env` files, tests, docs or the `.local` toolchain
  (`.dockerignore`). Tag images with the git SHA: `devcontext-api:<sha>`,
  `devcontext-web:<sha>`.
- Health means "process answers"; readiness (`GET /ready`) additionally runs
  `SELECT 1` and returns 503 while the process is draining. Neither response
  contains a connection string.
- Runtime knobs: `DATABASE_POOL_MAX` (per instance; instances × max must stay
  below the database connection limit), `DATABASE_STATEMENT_TIMEOUT_MS`,
  `SHUTDOWN_TIMEOUT_MS` (drain window after SIGTERM), `APP_ENV`, `RELEASE`.

### Environments
- `deploy/env/production.env.example`, `deploy/env/staging.env.example`
  (copy to `deploy/env/<env>.env`, git-ignored) and `deploy/env/ci.env`
  (committed, no real values). Staging and production use different
  databases, secrets, origins and `APP_ENV`; a preview stack always owns its
  own PostgreSQL (`deploy/compose.staging.yml` creates one) and must never
  receive a production `DATABASE_URL`.
- Production refuses to start with a missing or placeholder
  `BETTER_AUTH_SECRET`, non-HTTPS origins, the fake billing provider or
  `INSECURE_HTTP_ORIGINS=true` when `APP_ENV=production`, and (report 45)
  without `WEB_PROXY_SECRET`, with the fake AI provider, with a documented
  placeholder secret, with HTTP error-reporting endpoints, or with a
  non-loopback `DATABASE_URL` lacking `sslmode=require` or stricter. The rules
  apply when either `NODE_ENV` or `APP_ENV` says production. The startup error
  names the offending variables and never their values.
- E-mail (report 45): `EMAIL_PROVIDER=none` keeps password reset off and its
  routes unreachable. `log` (development and tests only, refused in
  production) writes messages to the log and, with `EMAIL_OUTBOX_FILE`, to a
  local JSON-lines file. Wiring a real provider (sender domain, SPF/DKIM) is an
  owner decision; it plugs into `apps/api/src/modules/email/sender.ts`.
- Operator panel (2026-10-04): `/admin` shows sign-ups, activity, the
  activation funnel, stored totals and the feedback inbox across every
  account. Only user ids listed in the API's `ADMIN_USER_IDS`
  (comma-separated) can open it; everyone else gets 403 and the page shows
  them their own id. Ids instead of e-mail addresses because sign-up does not
  verify addresses. Bootstrap: sign up on the deployment, open `/admin`, copy
  the id it shows into `ADMIN_USER_IDS`, restart the API. Empty (default)
  keeps the panel closed.
- Database TLS: node-postgres currently treats `sslmode=require` like
  `verify-full` (certificate and host name are checked) and will switch to the
  weaker libpq meaning in pg 9, so the production template uses
  `sslmode=verify-full`. A provider with a private CA needs `sslrootcert`.
- The web container of `deploy/compose.staging.yml` receives only `API_URL`
  and `WEB_PROXY_SECRET` (exported in the shell before `docker compose up`),
  never the database or session secrets from the env file.
- Secrets: generate with `openssl rand -base64 48`, keep them in the hosting
  provider's secret manager, inject at runtime. Rotation: `BETTER_AUTH_SECRET`
  → deploy the new value (all sessions end); database credentials → change the
  role password, update `DATABASE_URL`, restart; billing keys → rotate at the
  provider, then update `BILLING_*`. Rolling a rotation back means deploying
  the previous value from the secret manager's history.

### Delivery
- CI (`.github/workflows/ci.yml`): frozen install, audit, migration
  consistency, PostgreSQL drills, typecheck, lint, tests, build,
  `scripts/verify-bundle.mjs` (no server-only variable names or connection
  strings in browser chunks), Playwright, then the `containers` job builds both
  images, starts `deploy/compose.staging.yml` with `deploy/env/ci.env`
  (migrate → api → web), runs `scripts/smoke.mjs` and checks that stopping the
  API logs `shutdown_started` and `shutdown_complete`.
- Release order: (1) build and push images for the SHA, (2) run the migration
  job with the API image
  (`docker run --rm --env-file <env> devcontext-api:<sha> node node_modules/@devcontext/db/dist/migrate.js`),
  (3) roll the API, (4) roll the web, (5) run
  `node scripts/smoke.mjs --web <web> --api <api>` and stop the rollout on a
  failure. Migrations are additive (forward-fix only); a release that needs a
  destructive change ships in two steps (deploy code that tolerates both
  shapes, then the migration).
- Rollback: redeploy the previous image tag. The schema stays at the newer
  migration; because migrations are additive the previous release keeps
  working. If a migration itself must be undone, restore from the managed
  snapshot taken before the release (below) or write a forward migration.

### Dokploy on a single VDS (owner decision, 2026-10-04)
- `deploy/compose.dokploy.yml` is the production stack for a Dokploy
  "Docker Compose" service: migrate → api → web, no published host ports,
  `deploy/.env` written by Dokploy from its Environment tab (never committed).
- PostgreSQL 18.6 is a separate Dokploy database service on `dokploy-network`
  with TLS on (self-signed server certificate whose CN/SAN is the service's
  internal host); `DATABASE_URL` uses `sslmode=verify-full` with
  `sslrootcert` pointing at the mounted certificate.
- Only the web has a domain (hooliee.com behind Cloudflare, Full (strict) with a
  Cloudflare Origin CA certificate); the API is reachable only inside the stack
  because the web proxies every browser call server-side. Moving from
  oponoya.com to hooliee.com (2026-10-05) is a runbook of its own:
  `docs/48_HOOLIEE_DOMAIN_MOVE.md`.
- With Cloudflare in front, set `CLIENT_IP_HEADER=cf-connecting-ip` only once
  the origin accepts 80/443 from Cloudflare's ranges alone; otherwise a direct
  request could choose its own rate-limit key.

### Observability and alerts
- Error reporting: set `SENTRY_DSN` (store endpoint spoken directly) or
  `ERROR_REPORTING_URL` plus `ERROR_REPORTING_TOKEN`. Reports carry class,
  code, constraint, fingerprint, frames, request id, route, status, `APP_ENV`
  and `RELEASE`; never messages, bodies or headers. Delivery is rate limited
  and a failing transport is logged once a minute.
- Alerts (from the JSON logs and probes; none of them include user content):
  availability — `/ready` non-200 for 2 minutes; error rate —
  `category=unexpected_error` above 1 % of `category=http` lines over
  5 minutes; latency — p95 `durationMs` above 1 500 ms over 10 minutes;
  database exhaustion — any `database_pool_pressure` line or `/ready` 503 with
  "Database is unavailable"; failed webhooks — `billing` warn lines "not
  matched" or `webhook_signature_invalid` in 15 minutes; failed backups — the
  managed backup job or `pnpm db:verify` exiting non-zero; failed deletions —
  `account_deletion_blocked` lines or `account_deletions` rows not completed
  after 24 h.

### Backups and restore
- Production: managed PostgreSQL automated snapshots, encrypted at rest, with
  point-in-time recovery and a retention of `BACKUP_RETENTION_DAYS` (the
  number the Privacy page discloses). Take a manual snapshot before every
  migration release. Provider selection is an owner decision (blocker).
- Drill: `node scripts/restore-drill.mjs --target postgresql://…/scratch`
  snapshots the source, migrates and restores the scratch database, verifies
  every table checksum and compares business reads (users, resources,
  projects, context versions, subscriptions, deletion ledger) on both sides;
  evidence is written to `backups/restore-drill.json`. Run it against staging
  before each release and record the output in the release notes. It refuses
  a target that is the source under another spelling (`localhost` vs
  `127.0.0.1`, default port) and a target that already holds accounts, unless
  `--wipe-nonempty-target` is given explicitly.

### Runbooks
- **Deploy**: see "Delivery"; abort on smoke failure, roll back by image tag.
- **Migration**: review the SQL in the PR (CI checks it matches the schema),
  snapshot, run the migration job, watch `/ready`, then roll the code.
- **Rollback**: redeploy the previous tag; if the new migration is
  incompatible, restore the pre-release snapshot into a fresh database and
  switch `DATABASE_URL`, accepting data loss since the snapshot (announce it).
- **Restore**: managed snapshot → new instance → `pnpm db:verify` against the
  last logical backup if one exists → smoke → switch traffic.
- **Auth outage** (sign-in failing, sessions dropping): check `/ready` and the
  `auth_rejected` security lines; verify `BETTER_AUTH_URL` and `CORS_ORIGIN`
  match the public origins and `BETTER_AUTH_SECRET` did not change
  unintentionally; a rotated secret ends every session by design. The web app
  shows the "servise ulaşılamıyor" state instead of signing users out.
- **Payment webhook backlog**: events are idempotent and ordered by provider
  time; replay them from the provider dashboard, then run
  `POST /v1/billing/reconcile` for affected users (or let the Plan page do it
  on their next visit). `billing_events.status` shows what was applied.
- **Data-deletion retry**: pending rows in `account_deletions` (Handoff 11
  runbook above); fix provider connectivity, the user retries from Settings.
  Purge completed rows past retention with
  `pnpm db:retention --years <BILLING_RECORDS_RETENTION_YEARS>` (add
  `--dry-run` first); schedule it monthly.
