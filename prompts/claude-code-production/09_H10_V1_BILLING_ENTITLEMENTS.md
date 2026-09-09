# Handoff 10 — V1 Billing and Entitlements

Use this after the free product loop and portability flow are stable.

## Target

Implement provider-neutral Free/Pro entitlements and a secure billing boundary.
Do not couple core domain code directly to one commercial provider.

## Decision gate

Before provider-specific code, inspect repository configuration and owner-provided
decisions. If no payment provider/legal billing region has been selected:

- implement the provider-neutral domain, persistence, UI states and fake/test
  adapter;
- define the adapter contract and required environment variables;
- record provider activation as an external blocker;
- do not invent credentials, webhook URLs, prices, tax claims or mark live billing
  complete.

## Domain requirements

- Centralize plans, features and numeric limits in an entitlement service.
- Free users can complete the value loop with documented limits.
- Pro unlocks the documented individual features; Team features remain out of
  scope.
- Enforcement must exist in the API/service layer, not only hidden buttons.
- Model subscription/customer state, provider IDs, period and cancellation state
  without storing card data.
- Gracefully handle cancel-at-period-end, expired, failed/incomplete payment and
  delayed webhook states.

## Provider boundary

- Verify webhook signatures against the raw request body.
- Store/process webhook event IDs idempotently and tolerate reordering/retries.
- Never trust plan/price/customer IDs supplied by the browser.
- Keep secret keys server-only and redacted from logs/errors.
- Reconcile entitlement state from trusted provider events/API, with a documented
  recovery path.

## Web

- Add honest Free/Pro comparison, current plan and usage/limit visibility.
- Implement upgrade, manage/cancel and return-state UX when the provider adapter
  is configured.
- Do not use fake urgency, hidden cancellation or misleading "unlimited AI" copy.

## Tests

- entitlement matrix at/below/above limits;
- bypass attempts against direct APIs;
- valid/invalid signature, duplicate/reordered webhook and failed-payment cases;
- cancellation/grace-period behavior;
- secrets absent from logs and client bundles;
- Playwright free-limit and provider test-mode upgrade/manage flow when available.

## Acceptance criteria

- plan enforcement is deterministic and centralized;
- webhook processing is verified and idempotent;
- core product works without provider availability;
- external provider activation is explicitly evidenced or blocked;
- full verification gate passes.

## Deliverable

Create `docs/39_BILLING_HANDOFF.md`, update pricing/config/runbook/backlog and the
execution plan. End it with:

`Next prompt: prompts/claude-code-production/10_H11_V1_PRIVACY_LEGAL.md`
