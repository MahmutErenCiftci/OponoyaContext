# Claude Code project memory

Treat `AGENTS.md` as the canonical repository-wide engineering contract.

Before production-sequence work, read `docs/README.md`,
`docs/30_PRODUCTION_EXECUTION_PLAN.md` and
`prompts/claude-code-production/README.md`. Start every new implementation
session with `prompts/claude-code-production/00_SESSION_BOOTSTRAP.md` and execute
only one numbered handoff prompt at a time.

## Claude-specific working style

- Start by inspecting existing code and docs; do not invent architecture that conflicts with them.
- For tasks spanning multiple modules, create a short implementation plan before editing.
- Prefer incremental commits/patches that keep the repository runnable.
- When requirements are ambiguous, use the product docs and roadmap priority as the tie-breaker.
- If a proposed change adds a new infrastructure dependency, explain why existing stack cannot satisfy the need.
- Never "improve" the MVP by adding enterprise features early.
- When touching Context Compiler behavior, update fixtures in `examples/generated-context/` and tests.
- Treat `MANIFEST.json` as a historical ZIP inventory, not current truth.
- A schema or prompt existing does not mean the feature is implemented; require a
  numbered implementation report and passing acceptance evidence.
- Handoffs 1–12 are complete (reports 27–43; report 39 is the catalog slice and
  report 41 is the design-pack UI integration, so later reports are offset by
  two from the prompt names). Migrations 0000–0008 are applied and covered by
  tests; never regenerate them. The launch gate `docs/44_V1_LAUNCH_GATE.md`
  (2026-09-09) is **BLOCKED** on owner-only items (hosting, managed
  PostgreSQL, DNS/TLS, monitoring, repository publication, legal approval);
  the launch mode is a free beta (`BILLING_PROVIDER=none`, owner decision
  2026-09-10). Re-run the gate with staging evidence before any GO. Legal
  texts (`/legal/terms`, `/legal/privacy`) are configuration driven drafts:
  never fill `LEGAL_*`, `HOSTING_REGION` or retention values with guesses;
  unset keys render as placeholders and stay launch blockers.
- Deployment lives in `apps/*/Dockerfile`, `deploy/compose.staging.yml`,
  `deploy/env/*.env.example` and `docs/13_DEPLOYMENT.md`: migrations are a
  release step (never on boot), `/ready` fails while draining, secrets are
  never committed (`deploy/env/ci.env` is throwaway), and
  `scripts/{smoke,restore-drill,verify-bundle}.mjs` are the evidence tools.
  Do not add an error-reporting SDK; `lib/error-reporter.ts` speaks the Sentry
  store endpoint or a JSON webhook with content-free payloads. No hosting,
  database, DNS or monitoring account exists; never provision one.
- Account deletion goes through `modules/account/service.ts` only (typed
  e-mail, password verified first, billing revoked through the provider
  adapter, then Better Auth `deleteUser` + cascades); the `account_deletions`
  ledger has no foreign key to `users` on purpose and is the minimal billing
  record. The owner deferred writing tests for new slices until the product is
  complete (2026-09-09); keep existing suites green.
- The web UI follows the design pack in `../claude-ui-handoff` (27 reference
  screens, `DESIGN_SYSTEM.md`, `DOMAIN_BINDINGS.md`): Turkish copy, horizontal
  top navigation, right-hand drawers (`components/drawer.tsx`), the four-step
  full-page project wizard and shared components under `apps/web/components`.
  New screens reuse those pieces; do not reintroduce a left sidebar or PNG
  backgrounds.
  A compiler semantic change must bump `COMPILER_VERSION` (now 0.4.1), regenerate
  golden snapshots and `examples/generated-context`.
- Plan limits and features live only in `apps/api/src/modules/billing/plans.ts`
  and are enforced through `app.entitlements` in route handlers (create, restore,
  clone, import, export, bundle, diff); route tests that are not about plans
  inject `unlimitedEntitlements()` from `apps/api/test/support/memory-billing.ts`.
  The payment provider is an adapter (`modules/billing/provider.ts`); never accept
  plan, price or customer ids from the browser, verify webhooks over the raw
  body, and keep `BILLING_*` secrets on the API only. Provider activation is an
  owner decision; do not invent credentials or prices.
- The technology catalog (`data/catalog/*.json`, report 39) is read-only
  reference data compiled into `@devcontext/catalog`; it reaches a user's
  Library only through `/v1/catalog/*/library` as ordinary Resources with
  `metadata.catalogSlug`. Scores are editor assessments and the UI must say so.
  Logos come from Simple Icons via `scripts/fetch-logos.mjs`; never hand-edit
  `apps/web/lib/logo-manifest.json`. Colours in `apps/web/app/globals.css` are
  theme tokens (light default; dark under `[data-theme="dark"]` and, unless
  `[data-theme="light"]` is set, under the system preference); do not add
  hard-coded hex values.
- Precedence is Project > Recipe > Profile > Global; Recipes are references,
  never copies. The portable JSON format (version 1) is documented in report 38;
  bump the version and add an explicit rejection path before changing it.
- Route handlers record audit/analytics through `app.telemetry.record(...)` with
  content-free metadata; route tests inject `memoryAudit()` from
  `apps/api/test/support`. Destructive PostgreSQL drills run on a scratch database
  from `createScratchDatabase()`, never on `DATABASE_URL` itself.
- Repository tests that need real SQL use `createTestDatabase()` from
  `@devcontext/db/testing` (PGlite, test-only) instead of adding driver
  dependencies to `apps/api`.
- On this Windows workspace `node`/`pnpm` live in `.local/runtime`; use
  `./scripts/pnpm-local.ps1 <cmd>` or put that directory on `PATH` first. If
  Windows App Control blocks the native pnpm binary, `.local/runtime/pnpm.cmd`
  runs `pnpm run|exec|--filter|-r` through `pnpm-shim.mjs` (no installs); the
  real launcher is kept as `pnpm-native.cmd`.
- At the end of each handoff, update the execution plan and create the exact report
  required by that prompt. Never mark production-ready without a GO decision in
  `docs/44_V1_LAUNCH_GATE.md`.
