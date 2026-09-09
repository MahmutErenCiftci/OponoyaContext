# 42 — V1 Privacy, Account Lifecycle and Legal Surfaces Handoff

Target: V1.0 / Handoff 11 (`prompts/claude-code-production/10_H11_V1_PRIVACY_LEGAL.md`),
delivered on 2026-09-09 after `41_HYBRID_UI_HANDOFF.md`. The prompt names this
report `40_PRIVACY_ACCOUNT_HANDOFF.md`; numbers 39 and 41 were taken by the
catalog and UI slices, so the remaining reports are offset by two
(operations → 43, launch gate → 44).

## Decision gate

Legal identity, address, contact e-mail, jurisdiction, subprocessors, hosting
region and retention periods are owner/legal decisions. This slice ships the
mechanics (export, deletion, disclosures, Terms and Privacy routes) driven by
configuration and marks every unknown as an explicit placeholder and launch
blocker. No company identity or legal claim was invented. Tests for this slice
are deferred by owner instruction (2026-09-09: "test yazma, uygulama bitince
toplu yazılacak"); the existing suites still pass.

## Delivered

### 1. Data export (`GET /v1/account/export`)
- Account-level structured export, format `devcontext-account` version 1
  (`accountExportSchema` in `packages/contracts`): account (id, e-mail, name,
  created date), workspace settings, subscription state (plan, status,
  provider, period end, cancel flag), the Handoff 9 portable workspace document
  (format `devcontext` v1) verbatim, every compiled context version with its
  canonical JSON, export events and the content-free audit trail (up to 5 000
  rows). Never included: password hash, session tokens, verification values,
  provider secrets, billing events of other users.
- Downloaded from Settings › Gizlilik ve veriler as
  `devcontext-account-<date>.json` through the web proxy
  `apps/web/app/api/account/[[...path]]/route.ts`; the download is audited as
  `account.export_downloaded` with counts only.

### 2. Deliberate account deletion (`DELETE /v1/account`)
- Body `{ password, confirmation }` (`deleteAccountRequestSchema`). The typed
  confirmation must equal the account e-mail; the password is verified through
  Better Auth's `verify-password` endpoint before anything else runs
  (`AuthProvider.verifyPassword`).
- Order of operations in `modules/account/service.ts`:
  1. confirmation check → `400 confirmation_mismatch`;
  2. password check → `400 invalid_password`;
  3. ledger row in `account_deletions` (attempt counter, request id);
  4. billing revocation through the provider adapter
     (`BillingService.revokeForDeletion` → `BillingProvider.revokeCustomer`);
     a Free account without a provider customer needs nothing;
  5. Better Auth `deleteUser` (enabled in `auth/service.ts`): password check,
     user row, every session, session cookie cleared. PostgreSQL cascades
     (all `owner_user_id` and project/profile/recipe foreign keys are
     `ON DELETE CASCADE`) remove Resources, Tags, decisions at every scope,
     Profiles, Recipes, Projects, context versions, export events, import
     requests, workspace settings, sample ledger, compatibility rules, the
     subscription row and the audit trail in the same statement;
  6. ledger row marked `completed` with the provider identifiers.
- Retryable external state: when the provider throws or the record points at
  a provider that is not configured, the ledger row becomes
  `pending_external` with a content-free code
  (`billing_provider_unavailable` / `billing_provider_not_configured`), the
  API answers `409` with that code and the message "Nothing was deleted", the
  audit trail records `account.deletion_blocked` and Settings shows the state
  with a "Silmeyi yeniden dene" action that sends the same request again.
  A crash between steps 4 and 6 leaves a `requested` row; the retry finds
  the provider customer already gone (`not_found` is a success) and proceeds.
- After success the browser navigates to `/auth?mode=sign-in&deleted=1`; any
  stale cookie fails `getSession` because the session rows are gone, so the
  workspace redirects to sign-in.

### 3. Minimal billing record and retention
- `account_deletions` (migration `0008_account_deletions`, no foreign key to
  `users` on purpose) keeps: user id, status, attempts, timestamps, request id
  and the provider identifiers/plan/status of the revoked subscription.
  `billing_events.owner_user_id` is set to null by the existing cascade rule,
  so provider event ids survive without a link to a person. Neither table
  stores names, e-mails or content.
- Retention is documented in `docs/12_SECURITY_PRIVACY.md`; the periods
  themselves (`BILLING_RECORDS_RETENTION_YEARS`, `BACKUP_RETENTION_DAYS`) are
  configuration and remain placeholders until the owner sets them.

### 4. Privacy and security UX (Settings › Gizlilik ve veriler)
- `GET /v1/account` (`accountSummarySchema`): what is stored (row counts per
  table, including open sessions), integrations (billing linkage with
  provider/plan/status/test mode; the empty `external` list states that no
  GitHub or AI provider connection exists in this build), processing
  disclosures (`externalAi: false`, imported content stored as data) and the
  deletion state.
- The section (`apps/web/app/workspace/settings/privacy-section.tsx`) shows
  the counts, the disclosures, the account export button, the billing row with
  a link to the Plan page, links to Terms/Privacy, and the danger zone. The
  deletion dialog names the scope, requires the e-mail to be typed and the
  password to be re-entered, disables the destructive button until both are
  present, and explains that nothing is deleted if a step fails.
- No private data reaches logs or analytics: the security log lines
  `account_deleted` / `account_deletion_blocked` carry user id, code and
  request id only; error messages never echo the typed values.

### 5. Legal surfaces
- Public routes `/legal/terms` and `/legal/privacy`
  (`apps/web/app/legal/*`), linked from the sign-up form ("Hesap oluşturarak …
  kabul etmiş olursun", no marketing checkbox), the landing footer and
  Settings. Both pages read `GET /v1/legal` (`legalConfigSchema`), which is
  built from configuration in `legalConfigFrom()`:
  `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_CONTACT_EMAIL`,
  `LEGAL_JURISDICTION`, `LEGAL_EFFECTIVE_DATE`, `LEGAL_APPROVED_AT`,
  `LEGAL_SUBPROCESSORS`, `HOSTING_REGION`, `BACKUP_RETENTION_DAYS`,
  `BILLING_RECORDS_RETENTION_YEARS`, plus the billing provider id/test mode
  and the constant `externalAi: false`.
- Every unset value renders as `belirlenmedi: <ENV_KEY>` and the page carries
  a draft banner until all values exist and `LEGAL_APPROVED_AT` is set. The
  texts describe only real behaviour of this build (deterministic local
  compilation, no AI processing, text-only storage of imported content, the
  two cookies, the data inventory that mirrors the schema, immediate deletion,
  export rights). Refund terms and the liability cap are marked as pending
  legal review rather than stated.

### 6. Provider boundary
- `BillingProvider.revokeCustomer({ customerId, subscriptionId })` is now part
  of the adapter contract; the fake provider drops the customer in memory
  without emitting a webhook (mirrors a provider-side customer delete). A real
  adapter must cancel immediately and delete/detach the customer.

## Legal placeholder checklist (launch blockers)

| Key | Needed for | Status |
| --- | --- | --- |
| `LEGAL_ENTITY_NAME` | Terms §1, Privacy §1 controller | unset |
| `LEGAL_ENTITY_ADDRESS` | Privacy §1 | unset |
| `LEGAL_CONTACT_EMAIL` | Terms §1, Privacy §1/§7 | unset |
| `LEGAL_JURISDICTION` | Terms §10, Privacy §9 | unset |
| `LEGAL_EFFECTIVE_DATE` | both headers | unset |
| `LEGAL_SUBPROCESSORS` | Privacy §4 | unset |
| `HOSTING_REGION` | Privacy §4 | unset |
| `BACKUP_RETENTION_DAYS` | Privacy §6 | unset |
| `BILLING_RECORDS_RETENTION_YEARS` | Privacy §6 | unset |
| `LEGAL_APPROVED_AT` | removes the draft banner | unset (needs owner/legal review) |
| Refund policy, liability cap wording | Terms §6/§8 | text pending legal review |
| Real billing provider | Terms §6, Privacy §4 | owner decision (report 40) |

## Files

- API: `apps/api/src/modules/account/{repository,service,routes}.ts` (new),
  `apps/api/src/app.ts`, `apps/api/src/config.ts`, `modules/auth/service.ts`
  (`verifyPassword`, `deleteUser`, `user.deleteUser.enabled`),
  `modules/billing/{provider,fake-provider,service}.ts` (`revokeCustomer`,
  `revokeForDeletion`); test stubs in `apps/api/test/*.ts` gained the two new
  `AuthProvider` methods.
- Contracts: account summary/deletion/export and legal config schemas at the
  end of `packages/contracts/src/index.ts`.
- Database: `packages/db/src/schema.ts` (`accountDeletions`),
  `packages/db/drizzle/0008_account_deletions.sql` + journal/snapshot,
  `packages/db/src/backup.ts` table order; migration counts in
  `packages/db/test/{migrations,backup}.test.ts` updated to 9.
- Web: `apps/web/app/api/account/[[...path]]/route.ts`,
  `apps/web/lib/api.ts` (`getAccountSummary`, `getLegalConfig`),
  `apps/web/app/workspace/settings/{page,settings-client,privacy-section}.tsx`,
  `apps/web/app/legal/{legal-page,terms/page,privacy/page}.tsx`,
  `apps/web/app/auth/{page,auth-form}.tsx`, `apps/web/app/page.tsx` (footer
  links), `apps/web/app/globals.css` (privacy/legal styles).
- Docs: this report, `12_SECURITY_PRIVACY.md`, `13_DEPLOYMENT.md`,
  `17_API_CONTRACTS.md`, `08_DATA_MODEL.md`, `24_LAUNCH_CHECKLIST.md`,
  `30_PRODUCTION_EXECUTION_PLAN.md`, `README.md`, `CLAUDE.md`, `.env.example`.

## Verification

| Check | Result (2026-09-09) |
| --- | --- |
| `tsc --noEmit` in contracts, db, api, web | pass |
| `eslint` in api and web | pass |
| API unit/route tests | 33 files, 147 tests pass |
| db tests (migration replay from empty and from 0007, backup snapshot) | 7 tests pass |
| `pnpm db:migrate` on the development database | 0008 applied |
| `pnpm build` | pass; `/legal/terms`, `/legal/privacy`, `/api/account/[[...path]]` in the route table |
| Manual browser pass on the dev servers (throwaway account `h11-delete-…@example.test`) | `/legal/terms` and `/legal/privacy` render with the draft banner and `belirlenmedi: <KEY>` placeholders; Settings › Gizlilik ve veriler shows counts (1 audit row, 1 session), disclosures, the fake-provider billing row and the danger zone; `GET /api/account/export` answered 200 with the attachment header, format `devcontext-account`, no `password`/`token` substring; wrong password → 400 `invalid_password`; wrong e-mail → 400 `confirmation_mismatch`; the dialog deletion → redirect to `/auth?mode=sign-in&deleted=1` with the success notice; `GET /api/account` afterwards → 401 |
| Database after the manual deletion | `account_deletions`: `completed`, 1 attempt, no error, no provider (Free); 0 users with the test e-mail; 0 orphan sessions; API log line `account_deleted` with user and request id only |
| `pnpm test:e2e` (existing 13 journeys against the new production build, scratch database) | 13 / 13 pass (48 s) |
| Playwright journeys for export/deletion/legal | not written (owner deferred tests until the product is complete); covered by the manual pass above |

## Risks and follow-ups

- Better Auth's `deleteUser` runs the credential check a second time; the
  service verifies first so billing is never revoked on a wrong password.
- Backups still contain the deleted rows until they expire; the Privacy draft
  states this and the retention period is a placeholder.
- The audit row `account.deletion_requested` is itself removed by the cascade
  on success; the ledger row is the durable trace.
- Session cookie clearing relies on the `set-cookie` headers Better Auth
  returns; if a proxy strips them, the session rows are gone anyway.

Next prompt: prompts/claude-code-production/11_H12_PRODUCTION_OPERATIONS.md
