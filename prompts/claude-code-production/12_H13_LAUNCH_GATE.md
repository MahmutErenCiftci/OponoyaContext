# Handoff 13 — V1.0 Production Launch Gate

Use this only after Handoffs 1–12 have implementation reports.

## Objective

Perform an evidence-based go/no-go review. Do not add speculative features. Fix
only concrete launch blockers and regressions discovered by the gate.

## Audit inputs

- every numbered implementation report;
- `docs/23_MVP_ACCEPTANCE_CRITERIA.md` and `docs/24_LAUNCH_CHECKLIST.md`;
- production environment/config inventory with secret values hidden;
- latest CI, E2E, migration, security, accessibility and restore results;
- open blockers in `docs/30_PRODUCTION_EXECUTION_PLAN.md`;
- billing/legal/provider evidence where enabled.

## Required gates

### Product

- Complete signup → Library → Project → decisions → compile → preview/download
  export journey on desktop and mobile.
- Two Projects reuse shared preferences with different overrides.
- Empty/loading/error/stale/archive/history states are understandable.
- No placeholder navigation, fake counts or success messages without persisted
  state on the launch path.

### Security and privacy

- Run `prompts/SECURITY_REVIEW_PROMPT.md` against current code.
- Prove cross-user isolation for every entity and nested route.
- Verify cookies/CORS/CSRF/rate limits/security headers and secret redaction in the
  deployed staging environment.
- Prove export/delete account and integration revocation behavior.
- Zero open Critical/High findings. Accepted Medium/Low risks need owner, rationale
  and follow-up date.

### Data and reliability

- Replay migrations from empty and previous-version databases.
- Test concurrent idempotent writes and context version numbering.
- Complete backup/restore drill and verify canonical/history records.
- Confirm health/readiness, alert delivery and rollback procedure.

### Commercial/legal

- If paid launch: provider test/live configuration, signed webhooks, known price
  IDs, cancellation/failure handling and entitlement reconciliation are evidenced.
- If free beta: billing UI/routes are clearly disabled without breaking the app.
- Terms, Privacy, retention, subprocessors, company identity and contact details
  have explicit human approval. Draft placeholders are not launch-ready.

### Quality

- frozen-lockfile install, lint, typecheck, unit/integration tests, build,
  PostgreSQL tests and Playwright all pass in CI;
- critical pages pass keyboard, focus, contrast, responsive overflow and basic
  screen-reader semantics checks;
- no production console errors, broken links or secret-bearing source maps/client
  configuration.

## Decision format

Create a table with each gate: `PASS`, `FAIL` or `BLOCKED`, linked evidence,
owner and required action. The overall decision is:

- `GO` only when every required gate passes;
- `NO-GO` when a code/config defect remains;
- `BLOCKED` when external credentials, provider provisioning or human legal
  approval is missing.

Never convert missing evidence into a pass.

## Deliverable

Create `docs/42_V1_LAUNCH_GATE.md`. If GO, check Handoff 13 in the execution plan
and document release version/time and rollback checkpoint. If NO-GO/BLOCKED,
leave it unchecked and list the shortest remediation sequence.

Do not claim "production-ready" anywhere unless the overall decision is GO.
