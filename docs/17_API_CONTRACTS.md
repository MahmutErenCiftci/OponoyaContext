# 17 — API Contract Sketch

Prefix: `/v1`

Implementation status (V0.1–V0.2): health/readiness, Better Auth, `GET /v1/me`,
the Resource, Project, Project-decision, compile/context and export routes below
are implemented. Remaining product
routes are planned. No development owner ID is accepted; ownership comes only
from the resolved session.

## Authentication

- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/get-session`
- `GET /v1/me` -> authenticated DevContext user

## Resources

- `GET /v1/resources` -> search/filter by `q`, `type`, `tag`, `preference`, `archived`
- `POST /v1/resources` -> create with tags and optional global preference
- `GET /v1/resources/:id`
- `PATCH /v1/resources/:id` -> edit fields, replace tags/preference
- `DELETE /v1/resources/:id` -> soft archive and remove active global preference
- `POST /v1/resources/:id/restore`

## Profiles

Implemented (Handoff 7):

- `GET /v1/profiles` -> `q`, `type` (`stack | design | ai | deployment`),
  `archived` (`active` default | `archived` | `all`), `limit`, `offset`; summaries
  carry decision and project counts
- `POST /v1/profiles`, `GET /v1/profiles/:id` (with decisions),
  `PATCH /v1/profiles/:id`, `DELETE /v1/profiles/:id` (archive),
  `POST /v1/profiles/:id/restore`
- `PUT /v1/profiles/:id/decisions/:slot` and `DELETE /v1/profiles/:id/decisions/:slot`
  with the same body and Resource rules as Project decisions

Archived Profiles cannot be attached to new Projects (`profile_unavailable`,
identical for missing, foreign and archived IDs) but Projects already using them
keep inheriting their decisions.

## Project profiles

- Project create/update accept `profiles: [{ profileId, priority }]` and
  `rules: string[]`; responses include `profiles[]` (name, type, priority,
  archivedAt) and `rules[]`.
- `PUT /v1/projects/:id/profiles` replaces the attachment set and returns
  `{ profiles }`.
- `GET /v1/global-decisions` -> `{ decisions }` (the caller's Library rules).

## Projects

Implemented (Handoff 4):

- `GET /v1/projects` -> `q` searches name, description and product type;
  `status` is `active` (default), `archived` or `all`; optional `stage`;
  bounded `limit` (1–100) and `offset`
- `POST /v1/projects` -> create with name, description, product type, stage,
  platforms, priorities and `resourceIds`. Idempotent: send a UUID
  `Idempotency-Key` header (preferred) or a body `clientRequestId`; the header
  wins when both are present. The first request returns `201`; a retry with the
  same key returns `200` and the original Project, ignoring any changed fields.
- `GET /v1/projects/:id`
- `PATCH /v1/projects/:id` -> edit brief fields; when `resourceIds` is present
  the attachment set is replaced, otherwise attachments are untouched
- `DELETE /v1/projects/:id` -> archive (`status: "archived"`); attachments and
  Library data stay intact
- `POST /v1/projects/:id/restore`

- `POST /v1/projects/:id/clone` (Handoff 8A) -> `{ project, created }`; copies
  brief, rules, attachments, profile attachments and project decisions. Optional
  body `{ name }`; a UUID `Idempotency-Key` makes retries return the same clone
  (`200` instead of `201`).
- `POST /v1/projects/:id/save-as-profile` (Handoff 8A) -> `{ profile, created }`
  from the Project's own decisions; the `Idempotency-Key` doubles as the Profile id.

Attachment rules: each ID in `resourceIds` must be an active Resource owned by
the caller. Missing, foreign and archived IDs fail identically so the API never
reveals whether another user's Resource exists. Resources that are already
attached remain valid on later edits even if archived in the meantime, and their
`archivedAt` is reported in the Project response.

## Project decisions

Implemented (Handoff 5):

- `GET /v1/projects/:id/decisions` -> `{ decisions: [{ slot, source, effective, project, global }] }`.
  `project` is the explicit override or `null`; `global` is the inherited Library
  rule or `null`; `effective` is whichever wins (`source` says which). Sorted by slot.
- `PUT /v1/projects/:id/decisions/:slot` -> idempotent upsert of the Project
  override. Body: `mode`, `resourceId` (nullable), `priority`, `constraints`,
  `rationale`, `conditions`. `AI_DECIDE` must not name a Resource
  (`resource_not_allowed`); other modes require one (`resource_required`) that
  is active and owned by the caller (`resource_unavailable`, identical for
  missing, foreign and archived IDs).
- `DELETE /v1/projects/:id/decisions/:slot` -> removes only the override and
  returns `{ decision }` with the inherited view (Profile or Global), or `null`
  when nothing is inherited. Profiles and global rules are never modified
  through Project routes.
- `PUT /v1/projects/:id/decisions` -> `{ decisions: [{ slot, ...upsert }],
  removeSlots: [] }` applied in one transaction; Resource failures report
  `details[{ path: ["decisions", "<index>", "resourceId"] }]`. Returns the full
  decision list.

Each view now carries `profile` (winning Profile decision), `profiles[]` (all
Profile candidates, highest attachment priority first) and every record has
`origin { id, name, priority }` for Profile-sourced decisions. Precedence is
Project > Profile > Global.

Slots must match `decisionSlotSchema` (lowercase, namespaced, e.g.
`frontend.framework`, `custom.date_library`). A foreign Project is
indistinguishable from a missing one (404) on every nested route.

## Compile

Implemented (Handoff 6):

- `POST /v1/projects/:id/compile` -> `{ version, created }`. Stores a new
  monotonic version only when the canonical SHA-256 changed (`201`); otherwise
  returns the latest version unchanged (`200`). Concurrent compiles for one
  Project are serialized with a row lock.
- `GET /v1/projects/:id/context` -> `{ version | null, stale, draftHash,
  draftWarnings }`. `stale` is true when compiling now would change the hash.
- `GET /v1/projects/:id/context/versions` -> summaries (version, compiler
  version, hash, decision and warning counts).
- `GET /v1/projects/:id/context/versions/:version` -> full version with
  canonical JSON and previews for every export target.
- `GET /v1/projects/:id/context/diff?from=&to=` (Handoff 8A) -> `{ from, to, diff }`
  semantic diff (brief fields, decisions added/removed/changed, resources, rules,
  warnings); defaults to the latest version and the one before it; `diff` is
  null when fewer than two versions exist.

A context version carries `compilerVersion`, `contentHash`, the canonical
object (`canonicalContextSchema`) and `previews[]` (`target`, `fileName`,
`content`).

## Export

Implemented (Handoff 6):

- `POST /v1/projects/:id/exports` with `{ target, version? }` where target is
  `generic | agents | claude | cursor | copilot`. Renders the stored version
  (latest by default) and records an export event; a UUID `Idempotency-Key`
  header makes a retry return the original event (`200` instead of `201`). An
  uncompiled Project answers `409` with `details[{ path: ["version"], code:
  "context_not_compiled" }]`.
- `GET /v1/projects/:id/exports` -> export history (target, file name, context
  version, hash, time).

## Search, favorites, compatibility and workspace (Handoff 8A)

- `GET /v1/search?q=&limit=` -> `{ query, results[] }` over the caller's
  Resources, Projects, Profiles and Recipes (`kind`, `id`, `name`, `subtitle`,
  `archived`, `updatedAt`), ranked and owner-scoped.
- `PATCH /v1/resources/:id { favorite }` and `GET /v1/resources?favorite=true`;
  Resource mutation responses carry `warnings` (`DUPLICATE_SOURCE_URL`,
  `DUPLICATE_NAME`) and `duplicates[]` evidence.
- `GET /v1/compatibility-rules?resourceId=`, `POST /v1/compatibility-rules`
  (`kind: conflicts | requires`, `leftResourceId`, `rightResourceId`, `note`;
  identical rule replays with `200`), `DELETE /v1/compatibility-rules/:id`.
  Unavailable Resources are reported per side (`leftResourceId` /
  `rightResourceId`, `resource_unavailable`).
- `GET /v1/workspace/summary` -> owner-scoped counts (resources, favorites,
  projects, profiles, compiledProjects, contextVersions, exports).

## Reliability, security and audit (Handoff 8B)

- Every response carries `x-request-id` (server-generated UUID; a client-sent
  header is ignored), `cache-control: no-store` and `x-content-type-options:
  nosniff`. The same id appears in the error envelope and in the API log line.
- Browser mutations (any method other than GET/HEAD/OPTIONS) with an `Origin`
  header must match `CORS_ORIGIN` or `BETTER_AUTH_URL`; otherwise `403
  FORBIDDEN`. Requests without an origin (server-to-server) are unaffected.
- Rate limits are process-local fixed windows of 60 seconds, answered with
  `429 RATE_LIMITED`, `retry-after` and `x-ratelimit-limit/remaining/reset`:

  | Bucket | Key | Default per minute |
  | --- | --- | --- |
  | anonymous auth (`POST /api/auth/*`) | client IP (`TRUST_PROXY` decides whether `X-Forwarded-For` counts) | 30 |
  | authenticated reads (`GET /v1/*`) | user id | 600 |
  | authenticated mutations (`/v1/*`) | user id | 240 |
  | compile, exports, clone, save-as-profile | user id | 60 |

  Better Auth keeps its own sign-in/sign-up limits in addition.
- Request bodies default to 1 MiB (`413 PAYLOAD_TOO_LARGE`); the portable import
  route accepts 32 MiB of JSON plus 1024 bytes for its envelope. Reference URLs
  must be HTTP(S) and at most 2048 characters.
- `POST /v1/projects/:id/save-as-profile` answers `409 CONFLICT` with
  `details[{ path: ["idempotency-key"], code: "idempotency_key_in_use" }]` when
  the key already names a Profile that is not the caller's.
- `GET /v1/audit?entityType=&entityId=&limit=` -> `{ events[] }`: the caller's
  own append-only trail, newest first (`id`, `action`, `entityType`,
  `entityId`, `metadata`, `requestId`, `createdAt`). Actions are
  `<entity>.<verb>` such as `project.cloned`, `project.decision_changed`,
  `project.compiled`, `project.exported`, `resource.preference_changed`,
  `profile.created`, `account.created`. Metadata holds identifiers, enum
  values, slot keys and counts only. There is no update or delete route.

## Recipes, onboarding and portability (Handoff 9)

All routes below authenticate the caller and scope reads/writes to that user.

- `GET/POST /v1/recipes`, `GET/PATCH/DELETE /v1/recipes/:id`,
  `POST /v1/recipes/:id/restore`: list/create/read/edit/archive/restore Recipes.
- `PUT /v1/recipes/:id/profiles`: replace owned Profile references and priorities.
- `PUT/DELETE /v1/recipes/:id/decisions/:slot`: edit Recipe decisions.
- `POST /v1/projects/:id/save-as-recipe`: reusable Recipe, with optional
  `Idempotency-Key`. Projects apply it by `recipeId`, never by copying decisions.
- `GET /v1/workspace/settings`, `PATCH /v1/workspace/onboarding`:
  first-run state (`new`, `in_progress`, `skipped`, `completed`) and choice.
- `POST /v1/workspace/samples`: optional, versioned sample installation.
  Entity writes, decisions, tracking records and settings commit in one
  transaction under an owner lock. Retries/concurrent calls create one set;
  existing Library preferences are preserved.
- `DELETE /v1/workspace/samples`: deletes recorded samples in one transaction.
  Returns `409 CONFLICT` with detail code `samples_in_use` if a non-sample
  Project, Profile, Recipe, compatibility rule or a Project's inherited global
  preference references a sample. Nothing is deleted on conflict. The UI warns
  that edits made to the sample entities themselves are removed on success.
- `GET /v1/workspace/export`: compact UTF-8 `devcontext-export-YYYY-MM-DD.json`.
  Version 1 includes Library/Tags/preferences, Profiles, Recipes, Projects and
  compatibility rules. It excludes account/session/provider records and history.
  Export validates against the same import schema and byte/depth limits before
  returning a file. Unsupported/over-limit workspaces receive `409 CONFLICT`
  (`export_not_portable`) instead of an incomplete or unimportable download.
- `POST /v1/workspace/import`: `{ document, strategy, dryRun }`, where strategy
  is `skip` (default), `copy` or `replace`; `dryRun` defaults to true. Preview
  has no domain writes. Apply requires explicit confirmation in the UI and sends
  an `Idempotency-Key`; callers should retain that UUID when retrying. Applying
  commits the plan and request record together. Refs resolve within the file,
  never to another user's rows. A future version fails with `unsupported_version`.
- `GET /v1/projects/:id/context/bundle?version=`: deterministic ZIP of all five
  compiled targets, canonical JSON and manifest; owner-scoped and audited.

Portable bounds (`portableLimits` in contracts): 32 MiB UTF-8 document, depth 20,
1000 Resources, 200 Profiles, 100 Recipes, 200 Projects, 500 compatibility rules,
80 decisions per entity, 30 tags, 50 resource attachments and 10 Profile links.
File prompts/commands remain inert; URLs are validated and never fetched.
Null Resource refs in non-delegated decisions preserve unresolved intent after
deletion. Compiler 0.4.1 emits `RESOURCE_UNRESOLVED`; it never changes the mode
to `AI_DECIDE`. A non-null unknown ref is rejected.

The portable file is not a complete account backup: context versions, export
history, audit history and account settings are intentionally excluded. Above
the format bounds, a separate administrative export is still required.

## Recipes, onboarding, samples and portability (Handoff 9)

- `GET /v1/recipes` (`q`, `archived`, `limit`, `offset`; summaries carry
  decision, profile and project counts), `POST /v1/recipes` (`name`,
  `description`, `profiles: [{ profileId, priority }]`), `GET/PATCH/DELETE
  /v1/recipes/:id`, `POST /v1/recipes/:id/restore`, `PUT
  /v1/recipes/:id/profiles`, `PUT/DELETE /v1/recipes/:id/decisions/:slot`
  (same body and Resource rules as Project decisions). Foreign or archived
  Profiles answer `profile_unavailable` per position.
- `POST /v1/projects/:id/save-as-recipe` -> `{ recipe, created }`; the
  `Idempotency-Key` doubles as the Recipe id (`409 idempotency_key_in_use`
  when it names someone else's Recipe).
- Project create/update accept `recipeId` (nullable). A newly applied Recipe
  must be active and owned (`400`, `details[{ path: ["recipeId"], code:
  "recipe_unavailable" }]`); an already applied Recipe may be archived later
  and keeps contributing. Responses carry `recipe: { id, name, slug,
  archivedAt } | null`. Decision views gain `recipe` and `source` may be
  `recipe`; precedence is Project > Recipe > Profile > Global, and the
  Recipe's Profiles contribute with the Recipe's attachment priority.
- `GET /v1/workspace/settings` -> `{ settings: { onboardingState,
  onboardingChoice, sampleVersion, sampleInstalledAt, currentSampleVersion } }`;
  `PATCH /v1/workspace/onboarding { state, choice? }`.
- `POST /v1/workspace/samples` -> `{ settings, created, counts }` (`201` when
  something was added, idempotent by entity key); `DELETE /v1/workspace/samples`
  -> `{ settings, removed }` deletes exactly the recorded sample entities.
- `GET /v1/workspace/export` -> attachment `devcontext-export-<date>.json`
  in the portable format (`docs/38_V1_PORTABILITY_HANDOFF.md`). No account,
  session, provider or history data.
- `POST /v1/workspace/import { document, strategy?: skip|copy|replace,
  dryRun?: true }` -> `{ summary, applied, created }`. Validation of the whole
  document precedes any write (`unsupported_format`, `unsupported_version`
  with an explicit message, `duplicate_ref`, `unknown_ref`,
  `resource_required`, `resource_not_allowed`, `self_reference`, plus contract
  paths). `dryRun: false` applies the plan in one transaction; an
  `Idempotency-Key` returns the stored summary (`200`, `created: false`) on
  replay. Files are bounded by the 1 MiB body cap and `portableLimits`.
- `GET /v1/projects/:id/context/bundle?version=` -> `application/zip`
  attachment `<slug>-context-v<n>.zip` containing the five export files,
  `devcontext-context.json` and `devcontext-bundle.json`; recorded as an export
  event with target `bundle` (`exportEventTargetSchema`).
- Domain errors may carry a `publicMessage`, surfaced as the envelope
  `message` (never input values).

## Technology catalog (report 39)

Read-only reference data from `@devcontext/catalog`; every route requires a
session. Scores are 1–5 editor assessments, never measurements.

- `GET /v1/catalog`: `{ catalog: { version, technologyCount, stackCount,
  readinessCount, velocityCount, pendingReferenceCount, domains[{ id, label,
  count, note }], methodology } }`.
- `GET /v1/catalog/technologies` (`domain`, `type`, `q`, `tag`, `limit` ≤ 500,
  `offset`): `{ technologies: CatalogTechnologySummary[], total }`.
- `GET /v1/catalog/technologies/:slug`: `{ technology }` with resolved
  `alternatives`/`pairsWith` (`known: false` for slugs not in the catalog),
  `readiness`, `velocity` and `stacks`. Unknown slug → 404 with a public
  message; malformed slug → 400.
- `GET /v1/catalog/stacks`, `GET /v1/catalog/stacks/:slug`: presets with layers
  in order (language, frontend, backend, database, infra), `technologyCount`,
  `highlights`, and separate `prototypeSpeed` / `productionReadiness`.
- `GET /v1/catalog/library`: `{ links: { [catalogSlug]: resourceId } }` for the
  caller's active Resources created from the catalog.
- `POST /v1/catalog/technologies/:slug/library`: `{ resource, created }`; 201 on
  creation, 200 when an active copy exists or an archived copy was restored.
- `POST /v1/catalog/stacks/:slug/library`: `{ created[], existing[], skipped[] }`
  (expensive rate-limit bucket).
- `POST /v1/catalog/stacks/:slug/profile`: adds the stack to the Library and
  creates a stack Profile with one PREFERRED decision per preset slot:
  `{ profile, created, decisions[{ slot, resourceId, name, technologySlug }],
  library }`; an active stack Profile with the preset's name is returned with
  `created: false` and no decision changes (expensive bucket).
- Audit actions: `catalog.technology_added`, `catalog.stack_added`,
  `catalog.stack_profile_created` (slugs, booleans and counts only).

## Billing and entitlements (Handoff 10)

Plans are defined on the API; the browser never sends plan, price or customer
identifiers. Limit refusals are `403` with `details[0].code` `plan_limit`
(`path[0]` = `projects | resources | profiles | recipes`) or `plan_feature`, and a
plain `message` naming the limit and the way out. Enforced on
`POST /v1/resources|projects|profiles|recipes`, every `restore`, project
`clone`, `save-as-profile`, `save-as-recipe`, sample install, catalog Library
adds, non-dry-run imports (creates + copies), `POST /v1/projects/:id/exports`
(target), the bundle and the diff; the versions list is cut to the plan's history.

- `GET /v1/billing`: `{ billing: { entitlement { plan, reason, effectiveUntil,
  paymentProblem, cancelAtPeriodEnd }, usage { projects|resources|profiles|recipes:
  { used, limit, remaining } }, subscription { status, provider,
  currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, canceledAt, manageable },
  provider { id, configured, testMode }, plans[] } }`.
- `POST /v1/billing/checkout`: `{ url }` to the provider's checkout; `409
  billing_unavailable` when no provider is configured.
- `POST /v1/billing/portal`: `{ url }` to the provider's manage/cancel portal;
  `409 subscription_missing` without a provider customer.
- `POST /v1/billing/reconcile`: re-reads the subscription from the provider and
  overwrites local state; `{ entitlement, subscription }`.
- `POST /v1/billing/webhook`: unauthenticated; raw body verified with
  `x-devcontext-signature: t=<unix>,v1=<hmac-sha256>` (5-minute window);
  `{ received: true, eventId, status: processed | duplicate | ignored | unmatched }`;
  `400 webhook_signature_invalid` otherwise. Event ids are unique per provider and
  events older than the last applied one are ignored.
- Test mode only (`BILLING_PROVIDER=fake`): `POST /v1/billing/test/checkout/:sessionId
  { outcome: paid | failed | canceled }` and `POST /v1/billing/test/portal
  { action: cancel | resume | renew | fail_renewal | expire }`, each `{ url }`.
- Audit actions: `billing.checkout_started`, `billing.portal_opened`,
  `billing.reconciled`, `billing.webhook_processed` (provider id, event type,
  status; never customer ids or e-mail).

## Account lifecycle and legal surfaces (Handoff 11)

- `GET /v1/account`: `{ account: { user, createdAt, stored { resources, tags,
  profiles, recipes, projects, decisions, compatibilityRules, contextVersions,
  exports, auditEvents, importRequests, sessions }, integrations { billing
  { provider, configured, testMode, plan, status, linked }, external[] },
  processing { externalAi: false, importedContentStoredAsData: true },
  deletion { status none | pending_external | completed, attempts,
  requestedAt, lastAttemptAt, lastError, retryable } } }`.
- `GET /v1/account/export`: attachment `devcontext-account-<date>.json`, format
  `devcontext-account` v1: account, settings, subscription, the portable
  workspace document (`devcontext` v1), `contextVersions[]` with canonical
  JSON, `exports[]`, `auditEvents[]`. No password hash, token or secret.
- `DELETE /v1/account` body `{ password, confirmation }` (confirmation must equal
  the account e-mail). `200 { deleted: true, deletion }` and the session
  cookie is cleared; `400` with detail code `confirmation_mismatch` or
  `invalid_password`; `409` with detail code `billing_provider_unavailable` or
  `billing_provider_not_configured` when the provider step failed (nothing was
  deleted, the request can be repeated). Audit: `account.export_downloaded`,
  `account.deletion_blocked`; security log `account_deleted`.
- `GET /v1/legal` (public): `{ legal: { productName, draft, approvedAt,
  effectiveDate, entity { name, address, contactEmail, jurisdiction },
  processing { externalAi: false, billingProvider, billingTestMode,
  hostingRegion, subprocessors[] }, retention { accountDeletion: "immediate",
  billingRecordsYears, backupDays }, missing[] } }`; null values are unset
  configuration keys listed in `missing`.

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request is invalid",
    "requestId": "req-1",
    "details": [{ "path": ["name"], "code": "too_small" }]
  }
}
```

All API errors use the shared `apiErrorSchema` contract. Details are optional;
validation details contain field paths and codes, never input values. Domain
rules may attach their own detail codes, for example
`{ "path": ["resourceIds", "1"], "code": "resource_unavailable" }` when a
Project attachment is rejected. Unexpected errors return a generic message, with
a server-generated request ID for correlation.

## Pagination

Cursor-based when large lists justify it.

V0 can use small `limit/offset`, but API contract should avoid pretending infinite lists are always safe.

## Idempotency

`Idempotency-Key` is implemented on project create. Consider it as well on:
- import
- billing mutations
- AI job creation
