# 12 — Security & Privacy

## Threat model priorities

The product may later connect to:
- GitHub private repos
- coding-agent configuration
- AI provider API keys
- internal team rules

That makes secrets and private engineering context high-value.

## MVP requirements

### Authentication
- secure session cookies
- CSRF protection according to auth framework deployment
- rate-limit login/reset endpoints
- verified redirect/origin configuration

### Authorization
Every resource/project/profile query must be scoped to current user.
Never rely on IDs alone.

### Input validation
- validate API payloads with Zod
- enforce URL length/schemes
- sanitize display-only rich text
- no arbitrary server-side command execution

### Secrets
- no provider tokens in logs
- encrypted secret storage when integrations arrive
- separate encryption key from DB credentials
- least-privilege OAuth scopes
- secret rotation plan

### Billing boundary (Handoff 10)
- webhooks are verified with an HMAC over the raw request body and a 5-minute
  timestamp window; event ids are stored per provider so retries are idempotent
  and older events cannot roll state back
- the browser only receives redirect URLs; plan, price and customer ids are
  never accepted from it, and entitlements are enforced in the API
- `BILLING_SECRET_KEY` and `BILLING_WEBHOOK_SECRET` are server-only, never
  logged (structured logs are redacted) and never referenced by the web app
- no card, invoice or billing-address data is stored; only provider identifiers,
  period and cancellation state

### SSRF
URL metadata fetcher is a future SSRF risk.

When built:
- block localhost/private IP ranges
- DNS rebinding protections
- restrict schemes to HTTPS/HTTP
- max download size/time
- no automatic file:// or internal schemes

### Prompt injection
External web/repo text is data, not instruction.

### Private repository access
- opt-in
- minimal OAuth permissions
- fetch only requested files
- clearly display what is stored
- allow deletion/revocation

### Multi-tenancy
Before Team launch:
- authorization tests
- tenant isolation review
- no cross-workspace search leakage

## Controls in place after V0.3 (Handoff 8B)

- Session-derived ownership on every query; identical 404/400 answers for
  missing, foreign and archived entities (isolation matrix test).
- Origin check on browser mutations in addition to SameSite cookies; exact
  CORS origin; HTTPS origins enforced in production configuration.
- Process-local rate limits for anonymous auth, reads, mutations and
  compile/export/clone; Better Auth limits remain.
- 1 MiB body cap, HTTP(S)-only URLs of at most 2048 characters, bounded notes,
  metadata and constraint sizes.
- Structured logs with request ids; cookies, bodies, query strings and error
  messages are never logged at info level, and the debug-level message is
  redacted (connection strings, credentials, tokens, e-mail addresses).
- Append-only audit trail of major mutations with content-free metadata.
- Web security headers (CSP, frame denial, nosniff, referrer policy).
- Weekly and per-push dependency audit in CI failing on high/critical.

## Backups
- production managed DB automated backups
- restore drill
- context/version data included
- encrypted backups

## Dependency security
- lockfile committed
- automated vulnerability alerts
- patch critical framework/security releases promptly
- avoid abandoned packages for auth/security-critical paths

## Privacy UX
User must be able to:
- export their data
- delete account/data
- disconnect integrations
- understand whether AI processing is enabled

## Account lifecycle, deletion and retention (Handoff 11)

- **Export**: `GET /v1/account/export` returns the account, settings,
  subscription state, the portable workspace document, compiled context
  versions, export events and the content-free audit trail. Password hashes,
  session tokens, verification values and provider secrets are never part of
  any export.
- **Deletion**: `DELETE /v1/account` requires the typed account e-mail and the
  password (verified through Better Auth before anything else). Billing is
  revoked at the provider first; only then Better Auth deletes the user and
  every session, and PostgreSQL cascades remove all owned rows (Resources,
  Tags, decisions at every scope, Profiles, Recipes, Projects, context
  versions, export/import records, settings, samples, compatibility rules,
  subscription, audit trail) in one statement. Sessions are gone, so stale
  cookies cannot authenticate.
- **Retryable external failure**: if the provider cannot be reached or is not
  configured, nothing is deleted; the `account_deletions` ledger keeps a
  content-free code, the API answers 409 and Settings offers a retry.
- **What survives deletion** (minimal billing record): the ledger row (user
  id, attempts, timestamps, request id, provider customer/subscription ids,
  plan, status) and `billing_events` rows with their owner link set to null.
  No name, e-mail or content survives. Retention period:
  `BILLING_RECORDS_RETENTION_YEARS` (owner decision, placeholder until set).
- **Backups**: encrypted logical backups keep deleted rows until they expire
  (`BACKUP_RETENTION_DAYS`, placeholder until set); deleted accounts are never
  restored from backups.
- **Disclosures**: external AI processing is off by construction (the API
  never calls an AI provider); imported URLs, prompts, rules and install
  commands are stored as text and never fetched or executed; only the session
  and theme cookies exist. Settings and the Privacy page state all of this
  from configuration, not from copy.
- **Legal surfaces**: `/legal/terms` and `/legal/privacy` are configuration
  driven drafts; every unset value renders as an explicit placeholder and the
  draft banner stays until `LEGAL_APPROVED_AT` is set. See
  `docs/42_PRIVACY_ACCOUNT_HANDOFF.md` for the placeholder checklist.

## Production operations controls (Handoff 12)

- Images run as a non-root user, contain no environment files, tests or the
  local toolchain, and are health-checked; the client bundle is scanned after
  every build for server-only variable names and connection strings
  (`scripts/verify-bundle.mjs`).
- Startup validation refuses production without HTTPS origins, with the local
  development secret, with the fake billing provider or with
  `INSECURE_HTTP_ORIGINS`; errors name variables, never values.
- Error reports (Sentry store endpoint or a JSON webhook) carry the same
  content-free summary as the logs plus `APP_ENV` and `RELEASE`; the transport
  is rate limited and cannot delay a response.
- Secret generation, storage, rotation and rollback are documented in
  `docs/13_DEPLOYMENT.md`; no secret is committed (`deploy/env/*.env` is
  git-ignored, `deploy/env/ci.env` holds throwaway values only).
- Readiness fails during drain so no request reaches a stopping process; the
  pool is bounded per instance and pressure is logged without connection
  details.
