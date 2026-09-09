# Handoff 8B — V0.3 Reliability and Security Beta

Use this after V0.3 usability features pass.

## Target

Harden the modular monolith for an invited beta: security regression coverage,
auditable mutations, rate limiting, observability hooks and proven recovery.

## Security review

Use `prompts/SECURITY_REVIEW_PROMPT.md` against real code paths. Fix all Critical
and High findings in scope. Specifically inspect:

- auth cookies, trusted origins, CORS and CSRF behavior;
- every nested owner join and IDOR boundary;
- stored text rendering/XSS;
- URL validation/SSRF boundaries;
- logs and error envelopes for secrets/private content;
- unsafe handling of saved install commands or prompt text;
- transaction consistency and retry behavior.

## Required engineering work

- Apply bounded rate limits to sensitive auth and expensive/mutating endpoints.
  Document whether limits are process-local; do not add Redis without measured
  multi-instance need.
- Add structured security/product logs with request IDs and explicit redaction.
- Add an append-only audit record for major user-visible mutations: Project
  clone, decision change, compile/export and account-level destructive actions.
- Implement privacy-conscious product analytics events from
  `docs/15_ANALYTICS_METRICS.md`; do not send private Resource content.
- Add application error boundaries and actionable unavailable/retry UX.
- Provide automated development/test database backup and restore scripts that
  verify row counts/content hashes. Production managed-backup configuration is
  documented in Handoff 12.
- Add dependency/security scanning to CI using supported tooling already
  compatible with the lockfile.

## Reliability tests

- cross-user isolation matrix for every user-owned entity;
- malformed/oversized payloads and invalid URL schemes;
- concurrent create/compile/export/idempotency cases;
- migration replay from an empty database and from the previous migration;
- backup → destructive test mutation → restore → checksum/read verification;
- logs/errors contain no seeded secrets, cookies, tokens or private notes;
- critical E2E path under API-unavailable and recoverable failure states.

## Acceptance criteria

- no open Critical/High security issue;
- no known data-loss path;
- recovery procedure has automated evidence;
- useful logs/metrics exist without private content leakage;
- full verification gate passes.

## Deliverable

Create `docs/37_V0_3_RELIABILITY_HANDOFF.md` with the security finding table,
recovery evidence and remaining production risks. Update the execution plan and
end with:

`Next prompt: prompts/claude-code-production/08_H09_V1_ONBOARDING_IMPORT_EXPORT.md`
