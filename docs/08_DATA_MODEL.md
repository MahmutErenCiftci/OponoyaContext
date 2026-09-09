# 08 — Data Model

## Principles

1. Stable relational core.
2. JSONB only for metadata that is genuinely variable.
3. Explicit ownership on every user-created entity.
4. Soft archive for recoverable objects.
5. Version context outputs, not every trivial read.
6. Team-ready ownership shape without building team permissions now.

## Core tables

### users
Authentication-owned identity.

### resources

Represents anything reusable.

Important fields:
- `id`
- `owner_user_id`
- `name`
- `slug`
- `resource_type`
- `source_url`
- `docs_url`
- `repo_url`
- `install_command`
- `description`
- `metadata_json`
- `favorite` (migration 0004; favorites sort first and have their own filter)
- `visibility`
- `archived_at`

### tags
User-scoped tags.

### resource_tags
Many-to-many.

### profiles

Types:
- stack
- design
- ai
- deployment

Owner-scoped with a stable slug and `archived_at` (soft archive, migration
0003). Archived Profiles cannot be attached to new Projects; existing
attachments keep contributing decisions.

### profile_decisions
Decision slots attached to profile.

### recipes
Combines profiles plus recipe decisions. Owner-scoped with a stable slug and
`archived_at` (migration 0006). A Project references at most one Recipe
(`projects.recipe_id`, set null on delete); the Recipe's decisions rank between
Project and Profile scope and its Profiles (`recipe_profiles` with priority)
contribute to the Profile scope. Nothing is copied into the Project.

Migration 0006 adds `recipes.archived_at` and `projects.recipe_id` (nullable FK,
set null on Recipe deletion). Recipe/Profile attachments remain references;
precedence is Project > Recipe > Profile > Global. Archived Recipes continue
contributing to already linked Projects but cannot be newly applied.

### recipe_profiles
Many-to-many.

Handoff 9 also adds `workspace_settings` (onboarding and sample version),
`workspace_samples` (owner/key-unique records of installed entities), and
`import_requests` (owner/request-unique applied import summaries). Sample
installation/removal locks the settings row and commits domain rows, tracking
and settings atomically. Incoming non-sample references block removal rather
than allowing cascades to alter the user's work. No migration was needed for
the Handoff 9 corrective pass; migration 0006 remains unchanged.

### projects

Fields:
- `name`
- `slug`
- `description`
- `product_type`
- `stage`
- `platforms_json`
- `priority_profile_json`
- `status`
- `client_request_id` for idempotent create retries
- `recipe_id`: applied Recipe reference (migration 0006)
- `rules_json` (`rules`): explicit engineering rules, trimmed and de-duplicated,
  exported verbatim (migration 0003)

V0.1 semantics: `status` is `active` or `archived` (soft archive; no separate
`archived_at` column yet), `stage` is one of `experiment | mvp | production |
maintenance` validated by the API, `slug` is derived from the name plus a short
ID suffix at create time and never changes on rename, and `platforms_json` /
`priorities_json` hold trimmed, de-duplicated user strings in the order entered.

### project_resources

Reference-only attachment of saved Library Resources to a Project. The join has
real Project/Resource foreign keys and a composite primary key. Application writes
must verify same-user ownership and active Resource state. Existing references stay
readable if a Resource is archived later.

### project_profiles
Selected profile inheritance with an explicit `priority`; higher priority wins
when two Profiles decide the same slot, then decision priority, newest revision
and id.

### scoped decision tables

Use four physical tables rather than a polymorphic `scope_type/scope_id` pair:

- `global_decisions` → FK user
- `profile_decisions` → FK profile
- `recipe_decisions` → FK recipe
- `project_decisions` → FK project

Each table carries the same decision payload:
- `slot`
- `mode`
- `resource_id` nullable
- `priority`
- `constraints_json`
- `rationale`
- `conditions_json`

Why duplicate four small tables?
- real foreign keys
- simpler ownership joins
- fewer IDOR mistakes
- easier cascade deletion
- no polymorphic referential-integrity hole

A decision with `AI_DECIDE` may have no resource.

### project_resources
Reference-only saved resources that may not own a decision slot.

### compatibility_rules

Implemented in migration 0004 as owner-scoped, manually curated pairs:
`kind` (`conflicts` | `requires`), `left_resource_id`, `right_resource_id`,
optional `note`; unique per owner/left/right/kind. The compiler evaluates them
against the active stack and only warns. Framework-support and slot-specific
constraints remain future work.

### context_versions

Fields:
- `project_id`
- `version`
- `compiler_version`
- `canonical_json`
- `content_hash`
- `created_at`

### export_events
- target
- context_version
- exported file set
- timestamp

### workspace_settings, workspace_samples, import_requests

Migration 0006. `workspace_settings` (one row per user, created on first read)
holds first-run state (`onboarding_state`, `onboarding_choice`) and the
installed sample set version. `workspace_samples` records every entity the
optional sample set created (`key`, `entity_type`, `entity_id`, unique per
owner and key) so installation is idempotent and removal exact; no FK on
`entity_id` because rows span tables. `import_requests` stores the summary of
each applied import by `request_id` (unique per owner) for idempotent retries.

### audit_events

Implemented in migration 0005 as an append-only trail of major user-visible
mutations: `actor_user_id` (FK users, cascade), `action`, `entity_type`
(`account | resource | project | profile | compatibility_rule`), nullable
`entity_id`, `metadata` JSONB (identifiers, enum values, slot keys and counts
only; never Resource content), `request_id`, `created_at`. Indexed by
actor/time and by entity. The repository exposes insert and read only; the
production database role should additionally revoke UPDATE/DELETE on the table
(Handoff 12).

## Billing (migration 0007)

`subscriptions` holds one row per user (`owner_user_id` unique): `plan`,
`status`, `provider`, `provider_customer_id`, `provider_subscription_id`,
`current_period_start/end`, `cancel_at_period_end`, `canceled_at` and
`last_event_at` (provider time of the last applied event; older events are
ignored). `billing_events` records every received provider event with a unique
`(provider, provider_event_id)`, `event_at`, `status`
(`received | processed | duplicate | ignored | unmatched`) and a content-free
`note`; `owner_user_id` is set null on account deletion. Card, invoice and
address data are never stored. Entitlements are derived from these rows at read
time, never cached elsewhere.

## Future team ownership

Do not prematurely add a complex ACL engine.

Recommended future-compatible pattern:
- current tables use `owner_user_id`
- when V2 starts, introduce workspace ownership carefully
- migrate to an `owner_type/owner_id` or dedicated workspace foreign key through a planned migration

Avoid polymorphic authorization shortcuts that bypass database constraints in V1.

## Indexes to plan

- resources(owner_user_id, resource_type)
- resources(owner_user_id, lower(name))
- projects(owner_user_id, status)
- global_decisions(owner_user_id, slot) unique
- profile_decisions(profile_id, slot) unique
- recipe_decisions(recipe_id, slot) unique
- project_decisions(project_id, slot) unique
- context_versions(project_id, version desc)
- compatibility_rules(left_resource_id, right_resource_id)
- unique per tag name/user
- unique project slug/user

## Deletion

Account deletion must cascade or explicitly purge:
- resources
- profiles
- recipes
- projects
- contexts
- integration tokens

Audit/billing records that legally must remain should be separated and minimized.

### account_deletions (Handoff 11)
- one row per user who asked for deletion; `user_id` has **no foreign key** so
  the row survives the user row
- `status`: `requested` (attempt in flight or interrupted), `pending_external`
  (provider revocation failed, retryable), `completed`
- `attempts`, `last_error` (content-free code), `requested_at`,
  `last_attempt_at`, `completed_at`, `request_id`
- `billing_provider`, `billing_customer_id`, `billing_subscription_id`,
  `billing_plan`, `billing_status`, `billing_revoked_at`: the minimal billing
  record kept after deletion; never a name, e-mail or content
- migration `0008_account_deletions`; included in `backupTableOrder`
