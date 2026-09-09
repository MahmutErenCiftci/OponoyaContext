# Handoff 11 — V1 Privacy, Account Lifecycle and Legal Surfaces

Use this after entitlement behavior is complete.

## Target

Give an individual user real control over their data and prepare accurate launch
disclosures. Legal text remains subject to owner/legal review.

## Account/data requirements

- Provide authenticated structured data export using the portable format from
  Handoff 9.
- Implement a deliberate account-deletion flow with recent-authentication or
  equivalent confirmation appropriate to Better Auth.
- Deletion must purge or cascade user-owned Resources, Tags, decisions, Profiles,
  Recipes, Projects, context versions, export/import events, audit data that need
  not legally remain, sessions and connected-provider tokens.
- Revoke/disconnect external integrations and billing linkage where configured.
- Define retryable deletion state if an external provider is unavailable; do not
  leave a user believing deletion succeeded when it did not.
- Separate legally required minimal billing records from product/private content
  and document retention explicitly.

## Privacy/security UX

- Settings shows what is stored, export action, integration controls and deletion.
- Destructive confirmation names the scope and cannot be triggered accidentally.
- After success, invalidate sessions and prevent stale authenticated access.
- Clearly disclose whether external AI processing is disabled/enabled and that
  imported URLs/prompts are stored as data.
- Do not expose private data in analytics, logs, support identifiers or errors.

## Legal launch surfaces

- Add accessible Terms and Privacy routes using factual, configuration-driven
  product behavior.
- Mark them as drafts requiring owner/legal approval; do not fabricate company
  identity, address, subprocessors, retention periods or jurisdiction.
- Add a documented checklist of placeholders that must be supplied before launch.
- Show relevant Terms/Privacy links at signup and in settings without using
  pre-checked optional marketing consent.

## Tests

- user A cannot export/delete user B;
- export contains expected data and no tokens/password/session secrets;
- deletion removes all required rows and invalidates sessions;
- partial external failure is visible and safely retryable;
- legal/settings routes are accessible and contain no unresolved value disguised
  as a real legal claim.

## Acceptance criteria

- data export and account deletion work end to end;
- no orphaned private product data remains after successful deletion;
- external/legal unknowns are explicit launch blockers;
- full verification gate passes.

## Deliverable

Create `docs/40_PRIVACY_ACCOUNT_HANDOFF.md`, update security/launch docs and the
execution plan. End it with:

`Next prompt: prompts/claude-code-production/11_H12_PRODUCTION_OPERATIONS.md`
