# 40 — V1 Billing and Entitlements Handoff

Target: V1.0 / Handoff 10 (`prompts/claude-code-production/09_H10_V1_BILLING_ENTITLEMENTS.md`),
delivered on 2026-09-08 after `39_TECHNOLOGY_CATALOG_HANDOFF.md`. The prompt names
this report `39_BILLING_HANDOFF.md`; number 39 was taken by the catalog slice, so
this and the remaining reports are offset by one (privacy → 41, operations → 42,
launch gate → 43).

## Decision gate

No payment provider, legal billing entity, region or price has been chosen by the
owner. Following the prompt, this slice ships the provider-neutral domain,
persistence, UI states and a signed-webhook **fake/test adapter**, defines the
adapter contract and environment variables, and records provider activation as
an **external blocker**. No credentials, webhook URLs, prices or tax claims were
invented; live billing is not marked complete.

## Delivered

### 1. Plans and entitlements (`apps/api/src/modules/billing`)
- `plans.ts` is the single source of limits and features. Free: 3 active
  projects, 50 active Library resources, 2 profiles, 1 recipe, exports to the
  master prompt, `AGENTS.md` and `CLAUDE.md`, the last 3 context versions. Pro:
  500 / 5000 / 100 / 100, every export adapter (adds Cursor and Copilot), the
  zipped bundle, 50 versions of history and the diff. Import and export of the
  user's own data are available on every plan. Team features are out of scope.
- `resolveEntitlement(record, now)` is a pure function over the stored
  subscription and the clock: active/trialing → Pro until the period end; a
  period that ended without a renewal event keeps Pro for 3 days
  (`renewal_pending`) and then falls back to Free (`period_ended`);
  cancel-at-period-end keeps Pro until the paid period ends; `past_due` keeps
  Pro for 7 days with `paymentProblem: true` and then downgrades
  (`payment_failed`); `canceled` honours a remaining period; `incomplete`,
  `unpaid`, `incomplete_expired` and `expired` are Free.
- `EntitlementService` (decorated on the Fastify instance as
  `app.entitlements`) enforces limits **in the API layer**:
  `POST /v1/resources`, `/v1/projects`, `/v1/profiles`, `/v1/recipes`, every
  `restore`, project `clone`, `save-as-profile`, `save-as-recipe`, the sample
  installer, catalog "add to Library" (only technologies not yet in the Library
  count) and the stack preset Profile. Non-dry-run imports are checked against
  the same plan the import would apply (creates + copies per entity). Export
  targets, the bundle and the diff are feature-gated; the versions list is cut to
  the plan's history limit. Refusals answer 403 with `plan_limit` /
  `plan_feature` details and a plain message naming the limit and the way out.
  Archived rows never count, so archiving frees a slot immediately.

### 2. Persistence (migration 0007)
- `subscriptions`: one row per user (`owner_user_id` unique), plan, status,
  provider, provider customer/subscription ids, period, cancel state,
  `last_event_at`. No card, invoice or address data.
- `billing_events`: every received provider event keyed by
  `(provider, provider_event_id)` with a processing status
  (`processed | duplicate | ignored | unmatched`) and a content-free note.
- `SubscriptionRepository.applyEvent` runs in one transaction: record the
  event id first (a conflict is a retry and returns `duplicate` without
  changes), match the owner by checkout metadata or provider ids (`unmatched`
  otherwise), lock the subscription row, ignore events older than
  `last_event_at` (`ignored`, so reordering cannot roll state back), then
  overwrite the provider-owned fields. `applySnapshot` is the reconciliation
  path from a trusted provider read. `createUsageRepository` counts active
  entities per owner.

### 3. Provider boundary
- `provider.ts` defines the adapter contract (`createCheckout`,
  `createPortal`, `parseWebhook(rawBody, headers)`, `fetchSubscription`) and the
  normalised event shape. The browser only ever receives redirect URLs; plan,
  price and customer ids are never accepted from it.
- `signature.ts`: HMAC-SHA256 over `${timestamp}.${rawBody}` in an
  `x-devcontext-signature: t=…,v1=…` header, 5-minute tolerance, constant-time
  comparison. The webhook route parses the raw body inside its own content-type
  scope so the verified bytes are the received bytes.
- `fake-provider.ts` (`BILLING_PROVIDER=fake`, refused in production): checkout
  and portal are in-app pages (`/billing/checkout`, `/billing/portal`) whose
  actions are delivered as signed webhooks through the real
  `POST /v1/billing/webhook` route, so signature checks, idempotency and
  reordering are exercised end to end. State is in memory and no money moves.
- Configuration (`config.ts`): `BILLING_PROVIDER` (`none` default | `fake` |
  `stripe` reserved), `BILLING_WEBHOOK_SECRET` (≥ 32 chars, required when a
  provider is enabled), `BILLING_SECRET_KEY` and `BILLING_PRO_PRICE_ID`
  (server-only, for the real adapter), `BILLING_PRO_PRICE_LABEL` (display text).
  `stripe` is refused at startup until the adapter ships; secrets are never
  logged and the web app never references them (test).
- Routes: `GET /v1/billing`, `POST /v1/billing/checkout`,
  `POST /v1/billing/portal`, `POST /v1/billing/reconcile` (recovery: re-read the
  provider and overwrite local state), `POST /v1/billing/webhook`
  (unauthenticated, signature-verified), and in test mode
  `POST /v1/billing/test/checkout/:sessionId` and `POST /v1/billing/test/portal`.
  Audit actions `billing.checkout_started`, `billing.portal_opened`,
  `billing.reconciled`, `billing.webhook_processed` carry provider id, event
  type and status only; unmatched events are logged without identifiers.

### 4. Web
- `Plan` in the workspace navigation → `/workspace/billing`: current plan with
  an honest one-sentence status (renewal date, cancellation date, payment
  problem with grace date), usage meters for the four limits, an upgrade button
  only when a provider is configured (otherwise "Upgrades are not available in
  this environment yet"), "Manage subscription" when a provider customer exists,
  a "Test mode · no real payments" badge for the fake provider, return-state
  messages for `?billing=success|canceled|portal` (success confirms with
  `reconcile` if the webhook has not landed yet), and a Free vs Pro table with
  the price cell reading "Announced when billing goes live" until the operator
  sets `BILLING_PRO_PRICE_LABEL`. Copy states that nothing is deleted when a plan
  ends, that cancellation keeps Pro until the paid period ends, and that the
  compiler needs no AI credits. No urgency, no hidden cancellation.
- Test-mode pages `/billing/checkout` (pay, fail, cancel) and `/billing/portal`
  (cancel at period end, resume, renew, failed renewal, end now) are clearly
  labelled as simulated. Settings links to the Plan page; activity labels cover
  the billing actions. Limit refusals surface through the existing form errors
  with the API's message; the Context screen's Diff tab now shows the API's
  reason (for example the Pro requirement) instead of a generic failure.
- The Plan, checkout and portal buttons stay disabled until React has hydrated
  (`lib/use-hydrated.ts`); a Playwright trace showed a click on a
  server-rendered button being lost before hydration, which would also hit a
  fast human on a slow connection.
- Existing Playwright journeys that rely on Pro features (the zipped bundle in
  `portability.spec.ts`, the diff in `usability.spec.ts`) first assert the Free
  refusal in the UI, then upgrade through the test-mode provider
  (`e2e/support/billing.ts`) and continue.

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass (root `tsc --noEmit` + 9 workspace tasks) |
| `pnpm lint` | pass (root eslint incl. e2e + 9 workspace tasks) |
| `pnpm test` | pass — compiler 16, contracts 6, catalog 5, db 7, web 17, api 147 |
| `pnpm build` | pass (6 tasks) |
| `pnpm test:db` | pass — db 3 (migration 0007 replay + backup drill), api 5 on a scratch PostgreSQL database |
| `pnpm test:e2e` | pass — 13 journeys (Chromium, fake billing provider, scratch database) |

Coverage added: `billing.entitlements.test.ts` (resolution matrix for every
status, renewal and past-due grace, cancel-at-period-end, limits at/below/above
on Free and Pro with the exact messages, export/bundle/diff/history gates,
signature round trip, tampering, wrong secret, replay window and malformed
headers), `billing.repository.test.ts` (PGlite: unmatched → processed →
duplicate → stale ordering with the persisted event log, provider isolation,
snapshot overwrite, active-only usage counts, owner isolation),
`billing.routes.test.ts` (summary and plans, no-provider 409, full fake-provider
lifecycle through signed webhooks with content-free audit, duplicate/stale/
unmatched/tampered/expired/malformed webhooks with the secret absent from logs
and responses, twelve direct-API bypass attempts refused on Free and lifted on
Pro, history truncation), `packages/db` migration replay for 0007 with the
unique constraints, `apps/web/test/secrets.test.ts` (no secret names in web
sources) and `e2e/billing.spec.ts` (fourth project refused by the API with the
plan message, Cursor export refused, Plan page meters, upgrade through the
test-mode checkout, Pro lifts the limit, cancel at period end, failed renewal
warning, ending the subscription returns to Free without deleting data, mobile
overflow; screenshots `billing-free-desktop.png`, `billing-pro-desktop.png`,
`billing-mobile.png`).

## Acceptance criteria

- plan enforcement is deterministic and centralized — `plans.ts` +
  `EntitlementService`, enforced on every create/restore/clone/import/export
  route (tests above)
- webhook processing is verified and idempotent — raw-body HMAC with replay
  window, event ids unique per provider, stale events ignored (tests above)
- core product works without provider availability — `BILLING_PROVIDER=none`
  keeps the whole Free loop; checkout answers 409 with a public message and the
  UI shows no upgrade button
- external provider activation is explicitly evidenced or blocked — **blocked**:
  see below
- full verification gate — table above

## External blockers (not invented)

- Payment provider account, legal billing entity/region, tax handling and the
  Pro price are owner decisions. Until then `BILLING_PROVIDER=stripe` is refused
  at startup and no live checkout exists.
- Activation checklist for the real adapter: implement `BillingProvider` for
  the chosen provider (map its webhook event types to the normalised event,
  verify with the provider SDK against the raw body), set
  `BILLING_PROVIDER`, `BILLING_SECRET_KEY`, `BILLING_WEBHOOK_SECRET`,
  `BILLING_PRO_PRICE_ID`, `BILLING_PRO_PRICE_LABEL`, register
  `https://<api>/v1/billing/webhook` with the provider, run the webhook and
  bypass tests against the provider's test mode, then re-run this gate.

## Known risks and notes

- The fake provider keeps its state in process memory; restarting the API in
  development forgets simulated subscriptions while the database keeps the last
  applied state (reconcile then reports the subscription as expired).
- Limits are checked before the write, not inside the same transaction; two
  simultaneous creates at the boundary can both pass. The overshoot is at most
  one item per concurrent request and is corrected on the next create.
- A replayed non-dry-run import with an `Idempotency-Key` is planned again
  before the replay is detected; if the earlier import consumed the remaining
  allowance the replay answers 403 instead of returning the stored summary.
  Nothing is duplicated either way.
- The version history cut applies to the list only; older versions remain
  readable by number, and exports of older versions still work.

Next prompt: prompts/claude-code-production/10_H11_V1_PRIVACY_LEGAL.md
