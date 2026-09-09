# Handoff 12 — Production Operations and Deployment

Use this after privacy/account lifecycle work is complete.

## Target

Make the repository deployable and operable across isolated local, staging and
production environments with a documented rollback and recovery path.

## Provider boundary

Inspect owner-provided deployment choices. If hosting, managed PostgreSQL, DNS or
monitoring providers are not selected, implement portable containers/config and
provider-neutral runbooks, then record live provisioning as an external blocker.
Never create accounts, domains, credentials or production resources without
explicit authorization.

## Build and runtime

- Create reproducible, non-root, health-checked production images for web and API
  using the repository's pinned Node version. Reconcile outdated documentation
  instead of silently downgrading runtime versions.
- Use production-only dependencies/artifacts where practical and a strict
  `.dockerignore`; never bake `.env`, test data or secrets into images.
- Add graceful shutdown, bounded database pool behavior and startup/readiness
  semantics suitable for orchestration.
- Health means process alive; readiness verifies required dependencies without
  leaking connection details.

## Configuration and security

- Validate all required production environment variables at startup with secret
  values omitted from errors.
- Enforce exact production CORS/trusted origins, secure cookies behind HTTPS,
  trusted proxy settings and explicit public web/API origins.
- Document secret generation, storage, rotation and rollback. Do not commit real
  secrets.
- Apply security headers/CSP compatible with the actual app and verify no client
  bundle contains server credentials.

## Delivery pipeline

- CI must install from the pinned lockfile, lint, typecheck, test, build, verify
  migration consistency and run security checks.
- Define separate preview/staging/production config; preview must never use the
  production database.
- Run reviewed migrations as a release step, not auto-generated schema changes on
  application boot.
- Prefer forward-fix database migrations; document application rollback and
  incompatible-schema constraints.
- Add a post-deploy smoke check covering health, readiness, auth and one protected
  owner-scoped read.

## Observability and recovery

- Connect the existing monitoring boundary when provider configuration is
  available; include release/environment tags and redaction.
- Define actionable alerts for availability, error rate, latency, database
  exhaustion, failed webhooks and failed backups without alerting on user content.
- Configure/document managed PostgreSQL backups, retention and encryption.
- Perform and record a staging restore drill with checksum/business-read checks.
- Add operator runbooks for deploy, migration, rollback, restore, auth outage,
  payment webhook backlog and data-deletion retry.

## Tests/evidence

- build and start production images locally or in CI;
- shutdown/readiness/config-failure tests;
- staging migration and rollback compatibility check;
- security-header/CORS/cookie verification;
- backup restore drill evidence;
- post-deploy smoke script tested against a non-production environment.

## Acceptance criteria

- artifacts are reproducible and contain no secrets;
- staging and production isolation is explicit;
- deploy, migration, rollback and restore have tested procedures;
- live-provider steps are evidenced or accurately blocked;
- full verification gate passes.

## Deliverable

Create `docs/41_PRODUCTION_OPERATIONS_HANDOFF.md`, update deployment/security/
launch docs and the execution plan. End it with:

`Next prompt: prompts/claude-code-production/12_H13_LAUNCH_GATE.md`
