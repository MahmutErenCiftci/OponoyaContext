# 37 — V0.3 Reliability and Security Beta Handoff

Target: V0.3 reliability beta / Handoff 8B. Completed 2026-09-07 after
`36_V0_3_USABILITY_HANDOFF.md`.

## Security review

Reviewed against `prompts/SECURITY_REVIEW_PROMPT.md` on the real code paths
(auth proxy, every owner join, web proxies, exports, logs). No Critical or High
finding remains open.

| # | Severity | Area | Finding (code path) | Resolution |
| --- | --- | --- | --- | --- |
| 1 | High | Rate limiting | `/v1/*` had no limits; only Better Auth throttled sign-in/sign-up (`apps/api/src/modules/auth/service.ts`). Scripted compile/export/clone loops or credential stuffing through the proxy were unbounded. | Process-local buckets in `apps/api/src/lib/rate-limit.ts`: anonymous auth per IP, reads/mutations/expensive routes per user, `429` with `retry-after` and `x-ratelimit-*` headers. Applied inside `authenticate` so anonymous requests fail with 401 before touching a bucket. |
| 2 | High | Production cookie policy | `readConfig` accepted `http://` `BETTER_AUTH_URL`/`CORS_ORIGIN` in production; Better Auth only marks cookies `Secure` for HTTPS base URLs. | Production now fails fast unless both are HTTPS origins (`apps/api/src/config.ts`, tested). |
| 3 | Medium | CSRF | Mutations relied on SameSite cookies alone; the web proxies forward the browser's `Origin`, so it was available but unchecked. | `registerOriginGuard`: non-GET requests with an `Origin` outside `CORS_ORIGIN`/`BETTER_AUTH_URL` get `403`; server-to-server calls without an origin are unaffected. Logged as `origin_rejected`. |
| 4 | Medium | Observability | 500s logged only a category (no class, code or frames), no per-request line, no security events; operators could not correlate a report with a request. | One structured line per request (route pattern, status, duration, request id, user id), security warnings for 401/403/413/429 and rejected auth calls, `unexpected_error` with class, driver code, constraint, fingerprint and stack frames. Messages are redacted and only emitted at debug level. `x-request-id` is returned on every response and cannot be spoofed. |
| 5 | Medium | Input bounds | URL fields were HTTP(S)-only but unbounded in length; the body limit was Fastify's implicit default. | URLs capped at 2048 characters in contracts; explicit 1 MiB `bodyLimit` with a `413 PAYLOAD_TOO_LARGE` envelope; both tested with `javascript:`, `file:`, `ftp:`, `data:` and oversized inputs. |
| 6 | Medium | Client caching | `/v1` JSON answered without `cache-control`; the Next proxies forward upstream headers, so a shared cache could keep private context. | `cache-control: no-store` and `x-content-type-options: nosniff` on every API response. |
| 7 | Medium | Browser hardening | The web app set no CSP, frame or referrer policy. | `next.config.ts` sends CSP (self + Google Fonts, `frame-ancestors 'none'`, `object-src 'none'`), `X-Frame-Options: DENY`, nosniff, referrer and permissions policies; `x-powered-by` removed. Verified through Playwright. |
| 8 | Medium | Idempotent replay of save-as-profile | `save-as-profile` used the client `Idempotency-Key` as the Profile id (`profiles/repository.ts`). A key equal to another user's Profile id raised a generic 500, and the PostgreSQL concurrency drill showed that two simultaneous replays of the same key failed with 500 as well: the id-derived slug hit `profiles_owner_slug_unique` before the id arbiter was consulted. | Any insert conflict is now treated as "already created" and the earlier Profile is returned; a foreign id answers `409 CONFLICT` with `idempotency_key_in_use` without revealing ownership. Covered by the isolation matrix and the eight-way parallel replay in `reliability.integration.test.ts`. |
| 9 | Low | Auditability | No record of clone, decision, compile/export or archive actions. | Append-only `audit_events` (migration 0005), `GET /v1/audit`, overview activity card; metadata is content-free by type. |
| 10 | Info | IDOR review | Every repository scopes by owner, including nested joins (decisions → resources, project profiles → profiles, context versions → project lock, export idempotency → project). Clone and save-as-profile copy only rows already owned. | No change; a table-driven cross-user matrix (`apps/api/test/isolation.repository.test.ts`) now proves 28 read/mutation paths answer 404 for a foreign owner and that foreign resources/profiles cannot be linked. |
| 11 | Info | Stored XSS / SSRF / command execution | React escapes all stored text; reference links are HTTP(S)-validated before storage; no server-side URL fetching exists; install commands and prompt text are rendered as text and exported verbatim, never executed. | No change; documented as constraints for future enrichment work. |
| 12 | Info | User enumeration | Better Auth answers sign-up with "user already exists". | Accepted for the invited beta; rate limited per IP. |

Dependency audit (`pnpm audit`, 2026-09-07): one moderate advisory, esbuild
0.18 via drizzle-kit's TypeScript loader (GHSA-67mh-4wv8-2f99, development
server exposure). It is development-only and never serves; CI fails on high or
critical.

## Delivered

### 1. Rate limits, origin guard and request hygiene
- `apps/api/src/lib/rate-limit.ts`: fixed-window limiter, policy table, route
  classification (`expensiveRoutes`), header helper. Defaults per minute: auth
  30 per IP, reads 600, mutations 240, compile/export/clone/save-as-profile 60
  per user. Limits are process-local by design; a shared store is the documented
  multi-instance upgrade and is not needed for one API instance.
- `TRUST_PROXY` (default off) controls whether `X-Forwarded-For` is honoured;
  `LOG_LEVEL` overrides the per-environment default.
- `registerOriginGuard` and `registerObservability` in
  `apps/api/src/lib/observability.ts`; `genReqId` generates UUIDs and the
  `x-request-id` request header is ignored.

### 2. Structured logs with redaction
- `apps/api/src/lib/redact.ts`: masks connection strings, credentials, bearer
  tokens, e-mail addresses, long hex values and PostgreSQL key details;
  `summarizeError` yields class, code, constraint, fingerprint and frames.
- Log lines by `category`: `http`, `security` (`auth_required`,
  `origin_rejected`, `rate_limited`, `payload_too_large`, `auth_rejected`,
  `auth_sign_in`, `auth_sign_up`), `analytics`, `audit` (write failures),
  `unexpected_error`, `database_connection`.
- Request bodies, query strings, cookies and raw URLs are never logged.

### 3. Audit trail and analytics
- Migration `0005_uneven_iron_lad.sql`: `audit_events` (actor, action, entity
  type/id, content-free metadata, request id, time) with actor/time and entity
  indexes; cascade on account deletion.
- `modules/audit` (insert + owner-scoped list) and `modules/telemetry`
  (`app.telemetry.record`): route handlers record `project.created/cloned/
  updated/archived/restored/profiles_replaced/decision_changed/
  decision_removed/decisions_batched/compiled/exported`, `resource.created/
  preference_changed/archived/restored`, `profile.created/updated/archived/
  restored/decision_changed/decision_removed`, `compatibility_rule.created/
  removed` and `account.created` (from the auth proxy on successful sign-up).
  A failed audit write is logged and never fails the user action.
- Analytics events (`signup_completed`, `resource_created`,
  `resource_preference_set`, `profile_created`, `project_created`,
  `decision_changed`, `context_compiled`, `context_exported`) are emitted as
  `category: "analytics"` log lines with identifiers and counts only.
- `GET /v1/audit?entityType=&entityId=&limit=` and a "Recent activity" card on
  the workspace overview with human labels and links.

### 4. Error boundaries and unavailable/retry UX
- `lib/session.ts` distinguishes authenticated, anonymous and unavailable;
  every workspace page renders `ServiceUnavailable` (retry button, nothing lost,
  still signed in) instead of bouncing to sign-in during an outage; the auth
  page shows an unavailable banner.
- `app/error.tsx`, `app/global-error.tsx` (digest reference, try again, never
  the message) and `app/not-found.tsx` (missing and foreign entities look the
  same).
- Client mutations already surface envelope messages; Playwright now proves a
  failed compile can be retried in place.

### 5. Backup and restore drill
- `packages/db/src/backup.ts`: logical snapshot of every public table as exact
  text with per-table row counts and PostgreSQL-computed content hashes plus the
  applied migration hashes; restore refuses a different migration state,
  replaces all tables in one transaction and commits only when checksums match.
  `assertTablesCovered` fails when a new table is not in the dependency order.
- CLI (`pnpm db:backup | db:verify | db:restore --yes`), never printing
  connection strings; `backups/` is ignored.
- `createScratchDatabase()` in `@devcontext/db/testing` provisions a throwaway
  database for destructive drills so `DATABASE_URL` is never truncated.

### 6. CI
- `pnpm audit --audit-level=high` on every push and weekly (schedule);
  `pnpm test:db` now runs the db and API integration suites (migration replay,
  restore drill, concurrency).

## Data/config changes

- Migration `0005_uneven_iron_lad.sql` (`audit_events`). Applied to the
  development database; replayed in PGlite (from empty and from `0004`) and on
  PostgreSQL.
- New environment variables: `TRUST_PROXY` (default `false`), optional
  `LOG_LEVEL`. Production now requires HTTPS `BETTER_AUTH_URL` and
  `CORS_ORIGIN`.
- `packages/db` gains `./backup` export, `runMigrations()`,
  `createScratchDatabase()` and the `db:backup|db:verify|db:restore` scripts;
  `apps/api` gains `test:integration`; root `test:db` runs both integration
  suites. No dependency was added.
- Compiler unchanged (0.4.0); goldens untouched.

## Recovery evidence

| Drill | Where | Result |
| --- | --- | --- |
| Backup → destructive mutation → restore → checksum/read verification (PGlite) | `packages/db/test/backup.test.ts` | pass: exact round trip of unicode, multi-line text, JSONB (`1.0` preserved), enums, booleans, timestamps; mismatches detected; failed verification rolls back |
| Same drill on PostgreSQL 18.6 (scratch database) | `packages/db/test/postgres.integration.test.ts` | pass |
| Migration replay from empty and from migration 0004 | `packages/db/test/migrations.test.ts`, PostgreSQL integration test | pass, rows preserved |
| Concurrent compile/export/create/clone/save-as-profile on PostgreSQL (8 parallel each) | `apps/api/test/reliability.integration.test.ts` | pass: exactly one version/event/project/profile per key |
| API unavailable and recoverable failure journeys | `e2e/reliability.spec.ts` | pass |

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass — compiler 15, contracts 6, db 7, web 10, api 92 |
| `pnpm build` | pass |
| `pnpm test:db` | pass — db 3 (replay, restore drill, refusal), api 4 (concurrency) on a scratch database |
| `pnpm test:e2e` | pass — 9 journeys (foundation ×2, projects, decisions, context, composer, usability, reliability ×2) |
| `pnpm audit --audit-level=high` | pass (one moderate, development-only) |

Coverage added: `rate-limit.test.ts`, `redact.test.ts`,
`security.routes.test.ts` (origin, per-user/per-IP limits and headers, body
and URL bounds, correlation headers, log content at info and debug, audit and
analytics recording, audit failure isolation, sign-up auditing),
`audit.repository.test.ts`, `isolation.repository.test.ts` (cross-user
matrix, foreign linking, idempotency conflict, PGlite concurrency),
`reliability.integration.test.ts`, `backup.test.ts`, migration replay from the
previous migration, `apps/web/test/session.test.ts`, `e2e/reliability.spec.ts`.

## Acceptance criteria

- no open Critical/High security issue — findings 1 and 2 fixed, table above
- no known data-loss path — all mutations remain additive or soft; restore is
  transactional and verified; `assertTablesCovered` guards new tables
- recovery procedure has automated evidence — PGlite and PostgreSQL drills in
  `pnpm test` / `pnpm test:db` and CI
- useful logs/metrics without private content leakage — request, security,
  analytics and error lines; tests assert seeded secrets, cookies, notes and
  query strings never appear
- full verification gate passes — table above

## Remaining production risks

- Rate limits are per process; a second API instance doubles every budget until
  a shared store exists. Anonymous auth limits key on the client address only
  when `TRUST_PROXY=true` and the platform sets `X-Forwarded-For`; otherwise all
  proxied sign-ins share one bucket.
- Error monitoring is log-based; Sentry (or equivalent) wiring, alerting and
  managed database backups arrive with Handoff 12.
- The audit trail cascades with account deletion; a retention policy for legally
  required records must be decided with Handoff 11.
- The moderate esbuild advisory stays until drizzle-kit updates its loader; it
  does not affect runtime.
- Better Auth sign-up still reveals whether an e-mail is registered.

Next prompt: prompts/claude-code-production/08_H09_V1_ONBOARDING_IMPORT_EXPORT.md
