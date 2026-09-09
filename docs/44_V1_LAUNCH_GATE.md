# 44 — V1.0 Production Launch Gate

Target: Handoff 13 (`prompts/claude-code-production/12_H13_LAUNCH_GATE.md`),
reviewed on 2026-09-09 after `43_PRODUCTION_OPERATIONS_HANDOFF.md`. The prompt
names this file `42_V1_LAUNCH_GATE.md`; reports 39 (catalog) and 41 (UI) shifted
the numbering by two.

## Overall decision: **BLOCKED**

No code or configuration defect that would make the decision NO-GO was found in
this review. Launch is blocked on items only the owner can supply: hosting and
managed PostgreSQL, DNS/TLS, a monitoring destination, publication of the
repository so CI runs on a hosted runner, and legal identity and approval. The
billing mode was decided on 2026-09-10 (free beta, `BILLING_PROVIDER=none`),
which closes gate C1. The product is **not** declared production-ready.
Missing evidence is recorded as BLOCKED, never as PASS.

## Audit inputs

Reports 27–43 (`docs/README.md`), `docs/23_MVP_ACCEPTANCE_CRITERIA.md`,
`docs/24_LAUNCH_CHECKLIST.md`, `docs/30_PRODUCTION_EXECUTION_PLAN.md`,
`deploy/env/*.env.example` (configuration inventory, values hidden), the local
gate run of 2026-09-09 (`pnpm typecheck && pnpm lint && pnpm test && pnpm build
&& node scripts/verify-bundle.mjs && pnpm test:db && pnpm test:e2e`), the smoke
check and restore drill of report 43, the manual export/deletion pass of report
42, and the accessibility/console pass below.

## Gate table

| # | Gate | Status | Evidence | Owner | Required action |
| --- | --- | --- | --- | --- | --- |
| P1 | Complete signup → Library → Project → decisions → compile → preview/download export journey, desktop and mobile | PASS | `e2e/{foundation,projects,decisions,context,composer}.spec.ts` (13/13 pass on the production build, 390 px overflow assertions inside the specs); report 41 screenshot sets at 1440/1024/390 | — | — |
| P2 | Two Projects reuse shared preferences with different overrides | PASS | `e2e/composer.spec.ts` (two projects, one profile, different overrides, different context) | — | — |
| P3 | Empty/loading/error/stale/archive/history states understandable | PASS | Report 41 coverage table (empty states, unavailable state, stale readiness, archive tabs, version history/diff); `e2e/reliability.spec.ts` | — | — |
| P4 | No placeholder navigation, fake counts or unpersisted success on the launch path | PASS | Counts come from `GET /v1/workspace/summary` and `GET /v1/account`; catalog counts from `@devcontext/catalog`; legal pages label unset values as `belirlenmedi:` placeholders and are outside the launch path (drafts, see L1) | — | — |
| S1 | Security review of current code (`prompts/SECURITY_REVIEW_PROMPT.md`) | PASS | Findings table below: 0 Critical, 0 High; 2 Medium and 3 Low accepted with owner, rationale and follow-up | Owner | Confirm the accepted risks before launch |
| S2 | Cross-user isolation for every entity and nested route | PASS | `apps/api/test/isolation.repository.test.ts` (matrix over every read/mutation path incl. nested joins), report 42 (account routes are session-scoped; `/v1/legal` is public by design) | — | — |
| S3 | Cookies/CORS/CSRF/rate limits/headers/redaction verified **in the deployed staging environment** | BLOCKED | Verified locally only: `apps/api/test/security.routes.test.ts`, smoke check asserts CSP on the landing page, production config refuses HTTP origins; no staging environment exists | Owner | Provision staging (hosting + managed PostgreSQL + TLS), deploy with `deploy/env/staging.env`, run `scripts/smoke.mjs` and the header/cookie checks there |
| S4 | Export/delete account and integration revocation | PASS | Report 42 manual pass (export without secrets, wrong password/e-mail refused, deletion → sessions gone → 401, ledger `completed`); fake-provider revocation path; no other integrations exist | — | Real provider revocation is exercised only once a provider is activated (C1) |
| S5 | Zero open Critical/High findings | PASS | Table below; report 37 findings 1–9 remediated | — | — |
| D1 | Migrations replay from empty and from the previous version | PASS | `packages/db/test/migrations.test.ts` (0000–0008 from empty and from 0007), `pnpm test:db` PostgreSQL replay | — | — |
| D2 | Concurrent idempotent writes and context version numbering | PASS | `packages/db/test/postgres.integration.test.ts` and `apps/api/test/reliability.integration.test.ts` (one version per concurrent compile, one export/create per key, concurrent audit appends) | — | — |
| D3 | Backup/restore drill with canonical/history verification | PASS (local) | `scripts/restore-drill.mjs` 2026-09-09: 27 tables, all checksums match, business reads equal incl. `context_versions` (73) and `export_events`; `pnpm test:db` drill | Owner | Repeat against the managed database once it exists (D5) |
| D4 | Health/readiness, rollback procedure | PASS (procedure) | `/health`, `/ready` (503 while draining), lifecycle logs, config refusal evidenced locally; deploy/rollback runbooks in `docs/13_DEPLOYMENT.md`; CI `containers` job asserts the drain | Owner | First real rollback rehearsal on staging |
| D5 | Alert delivery and managed backups | BLOCKED | Alert rules and backup policy documented; `SENTRY_DSN`/`ERROR_REPORTING_URL` transport implemented; no monitoring account, no managed database | Owner | Choose providers, set `SENTRY_DSN` or the webhook, enable snapshots with `BACKUP_RETENTION_DAYS`, send one test alert |
| C1 | Paid launch: provider test/live config, signed webhooks, price ids, cancellation/failure, reconciliation — or free beta with billing clearly disabled | PASS (free beta) | Owner decision 2026-09-10: launch as a **free beta** with `BILLING_PROVIDER=none`. Evidence that the app stays intact without a provider: `apps/api/test/billing.routes.test.ts` (checkout answers 409 `billing_unavailable`, nothing changes), Plan page hides the upgrade and portal actions and states "Bu ortamda yükseltme henüz açık değil" (`billing-client.tsx`), every entitlement resolves to Free; the paid path stays covered by the fake-provider journey for later activation (report 40) | Owner | Keep `BILLING_PROVIDER=none` in the production environment; a later paid launch re-opens this gate with provider evidence |
| L1 | Terms, Privacy, retention, subprocessors, company identity, contact with explicit human approval | BLOCKED | `/legal/terms`, `/legal/privacy` are drafts; `GET /v1/legal` lists 10 missing keys; placeholder checklist in report 42 | Owner + legal | Supply `LEGAL_*`, `HOSTING_REGION`, retention values; legal review of refund/liability wording; set `LEGAL_APPROVED_AT` |
| Q1 | Frozen-lockfile install, lint, typecheck, tests, build, PostgreSQL tests and Playwright **in CI** | BLOCKED (passes locally) | Local gate 2026-09-09: typecheck/lint 10/10 tasks, 198 unit/integration tests, build, bundle guard clean (44 chunks), `test:db`, e2e 13/13; `.github/workflows/ci.yml` defines the same plus the container job, but the repository is not published, so no hosted run exists | Owner | Publish the repository (or self-hosted runner) and record the first green run, including the `containers` job |
| Q2 | Critical pages: keyboard, focus, contrast, responsive overflow, basic semantics | PASS | Pass of 2026-09-09 on `/`, `/auth`, `/legal/*`, `/workspace`, `/workspace/{library,projects,settings,billing}`: 0 console errors, one `main`/`h1` per page, every visible control labelled, all images with `alt`, visible focus on the first eight tab stops, `lang="tr"`, 0 px overflow at 390 px on fresh load; at 1024 × 768 the four wizard steps, project creation, overview and stack pages render with 0 px overflow and no console errors; token contrast ink 18.5:1, muted 6.7:1, accent text 5.1:1, muted-on-subtle 6.3:1 (all ≥ 4.5:1). Screen-reader semantics are structural checks only (landmarks, names), not an assistive-technology session | — | Optional: a screen-reader session before public launch |
| Q3 | No production console errors, broken links, or secret-bearing source maps/client config | PASS | Q2 console pass; `scripts/verify-bundle.mjs` clean; Next production build emits no source maps for the client by default; e2e journeys follow every navigation on the launch path | — | — |

## Security review (current code, 2026-09-09)

Scope: Handoffs 11–12 on top of the report 37 baseline (auth, IDOR, ownership,
cookies, CORS/CSRF, SSRF, stored XSS, secrets, logging, OAuth scope, prompt
injection, command execution, transactions).

- **Critical**: none.
- **High**: none.
- **Medium**
  1. `INSECURE_HTTP_ORIGINS=true` lets a production build run over plain HTTP
     when `APP_ENV` is preview or staging (`apps/api/src/config.ts`); session
     cookies are then not `Secure`. Accepted for laptop/CI stacks bound to
     127.0.0.1 only. Owner: operator; follow-up: the staging environment must
     terminate TLS and keep the flag `false` (review at staging provisioning,
     see S3).
  2. Rate limits are process-local (`apps/api/src/lib/rate-limit.ts`); with
     more than one API instance the per-user and per-IP buckets multiply.
     Accepted for a single-instance launch. Owner: operator; follow-up: shared
     store before scaling out (documented since report 37).
- **Low**
  1. `DELETE /v1/account` verifies the password server-side; repeated wrong
     passwords on an existing session are bounded only by the per-user
     mutation limit, not by Better Auth's sign-in limiter
     (`modules/account/routes.ts`). Acceptable: the attacker already holds the
     session. Follow-up: none required.
  2. Billing is revoked at the provider before Better Auth deletes the user
     (`modules/account/service.ts`); if the user deletion then fails, the
     subscription is already cancelled while the account remains (ledger row
     `requested`, retry succeeds because `not_found` is treated as revoked).
     Impact: lost paid time in a rare double failure. Owner: product;
     follow-up: reconsider once a real provider supports pause instead of
     cancel.
  3. Better Auth still answers sign-up with "user already exists" (enumeration,
     report 37 #12), rate limited per IP. Accepted for the invited beta.
- Verified as non-issues: `/v1/legal` exposes only operator configuration
  meant for publication; the error reporter posts to operator-configured
  URLs only (no user input, 3 s timeout, content-free payload); legal pages
  render configuration through React (escaped); images run non-root without
  `.env`; the bundle guard found no server variable names; audit rows and
  logs for deletion carry ids only; account export never includes password
  hashes, tokens or verification values (schema-enforced).
- **Tests that should be added** (deferred by the owner until the product is
  complete, 2026-09-09): user A cannot export/delete user B; export contains no
  secret substrings; deletion removes every owned row and invalidates sessions;
  blocked provider revocation is visible and retryable; legal routes contain no
  unresolved value disguised as a claim; readiness returns 503 while draining;
  config refusal for each production rule; error reporter rate limiting and
  payload shape; smoke script against the Compose stack.

## Configuration inventory (values hidden)

Required in production (`deploy/env/production.env.example`): `NODE_ENV`,
`APP_ENV=production`, `RELEASE`, `DATABASE_URL` (TLS), `CORS_ORIGIN` (https),
`BETTER_AUTH_URL` (https), `BETTER_AUTH_SECRET` (≥ 32 chars, not the local
default), `TRUST_PROXY`, `BILLING_PROVIDER` (`none` until C1),
`SENTRY_DSN`/`ERROR_REPORTING_URL` (D5), `LEGAL_*`, `HOSTING_REGION`,
`BACKUP_RETENTION_DAYS`, `BILLING_RECORDS_RETENTION_YEARS`,
`LEGAL_APPROVED_AT` (L1). None of these values exists yet.

## Shortest remediation sequence

1. Owner decisions (parallel): hosting + managed PostgreSQL + region; DNS/TLS
   for the web and API origins; monitoring destination; legal values and
   reviewer. (Billing mode decided: free beta, `BILLING_PROVIDER=none`.)
2. Publish the repository → first hosted CI run incl. the `containers` job (Q1).
3. Provision staging from `deploy/env/staging.env.example`; run the migration
   job, `scripts/smoke.mjs`, header/cookie checks, the restore drill against
   the managed database, one test alert, one rollback rehearsal (S3, D3–D5).
4. Fill `LEGAL_*` and retention values, legal review, set `LEGAL_APPROVED_AT`
   (L1).
5. Re-run this gate with the staging evidence attached; only then may the
   decision become GO and Handoff 13 be checked in the execution plan.

Handoff 13 stays unchecked in `docs/30_PRODUCTION_EXECUTION_PLAN.md`.
