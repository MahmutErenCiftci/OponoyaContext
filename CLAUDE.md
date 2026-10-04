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
  two from the prompt names). Migrations 0000–0010 are applied and covered by
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
  screens, `DESIGN_SYSTEM.md`, `DOMAIN_BINDINGS.md`): Turkish reference copy, right-hand
  drawers (`components/drawer.tsx`), the four-step full-page project wizard and
  shared components under `apps/web/components`. Navigation changed by owner
  decision on 2026-09-30 (`app/workspace/workspace-navigation.tsx`): work
  sections live in a collapsible left sidebar (drawer on phones), learning and
  discovery (Katalog, Yenilikler; later guides or community) live in the slim
  top bar next to search, theme and account. Desktop (≥1024px) renders at 90 %
  through `zoom` on `html` (owner found 100 % oversized); full-height rules
  divide viewport units by `--ui-zoom`. Overview news entries live in
  `apps/web/lib/announcements.ts` (shipped changes only). New screens reuse
  those pieces; do not add PNG backgrounds.
- Public development plan (owner decisions 2026-09-30, `apps/web/lib/roadmap.ts`,
  shown on the Plan page): nothing is charged while the product is in
  development; a Free account stays permanently; Pro arrives with V2 at a fixed
  14,99 $ with a 4,99 $ development discount until the product is complete and
  has real users; the newest AI features and enterprise usage/pricing come after
  V3. These are display texts only — `modules/billing/plans.ts` and the billing
  provider are unchanged. While no AI provider is configured, AI actions
  (suggestions, consent, stack suggestion) render faded with "Yakında · Pro"
  (`components/coming-soon.tsx`); compiled "AI talimatları" and the AI_DECIDE
  decision mode are core features and stay active.
  A compiler semantic change must bump `COMPILER_VERSION` (now 0.4.4), regenerate
  golden snapshots and `examples/generated-context`. Export adapters treat user
  text as data (report 45): keep using the `inline`/`paragraph`/`codeSpan`
  helpers for anything a user, an import or an AI proposal wrote.
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
- Report 45 (`docs/45_PRODUCTION_HARDENING_REPORT.md`, 2026-09-26) records the
  production hardening pass: security fixes, performance work, AI groundwork
  (`AI_PROVIDER=none` by default; activating a real provider is an owner
  decision that also needs the Privacy text and subprocessors), password
  change, migration 0009 and the remaining owner decisions. Product identity
  lives in `packages/contracts/src/brand.ts` (`productName` etc.) and
  `GENERATOR_NAME` in the compiler; an API test keeps them equal. Since
  2026-10-05 the product is "hooliee" (lower case) on hooliee.com and Oponoya
  is the studio credited in the footer; the move is `docs/48_HOOLIEE_DOMAIN_MOVE.md`.
  `WEB_PROXY_SECRET` must match on the API and the web service. Per-entity
  decisions (80) and compatibility rules (500) are bounded like the portable
  format. Password reset runs through Better Auth behind
  `modules/email/sender.ts` (`EMAIL_PROVIDER=none` by default; `log` is
  development-only); its routes are proxied only when a sender exists, and a
  real e-mail provider is an owner decision. Report 46 lists the researched
  product gaps and recommendations.
- Operator panel and feedback (2026-10-04, migration 0010): `/admin` reads
  cross-account counts through `modules/admin` (the only cross-account
  module) and is open only to user ids in the API's `ADMIN_USER_IDS`; ids, not
  e-mails, because sign-up does not verify addresses. Users send suggestions,
  complaints and bug reports from the top-bar drawer or
  `/workspace/feedback` (`modules/feedback`, own rate-limit rule); the message
  is user text, never logged or audited, included in the account export and
  deleted with the account. Correlated SQL in `modules/admin/repository.ts`
  names columns through aliases because Drizzle leaves interpolated columns
  unqualified in single-table selects.
- The interface is bilingual (2026-10-04): Turkish is the reference copy and
  English sits next to it in `defineCopy({ tr, en })` from `apps/web/lib/i18n.ts`;
  `NoInfer` makes the English shape follow the Turkish one, so a missing key is
  a type error. Server components read `getLocale()` (`lib/locale-server.ts`),
  client components `useLocale()` (`components/locale-provider.tsx`), plain
  client helpers `documentLocale()`. `apps/web/proxy.ts` resolves the language
  once per request (`/en`, then the `devcontext-locale` cookie, then
  Accept-Language) and passes it in an internal header it overwrites; `/en` is
  the English landing and `/` stays Turkish for crawlers. Every new UI string
  needs both languages; API errors get their text from codes in
  `lib/errors.ts`, and catalog descriptions stay Turkish (the catalog says so).
  Playwright runs as a Turkish browser; `e2e/i18n.spec.ts` covers English.
- Wizard technology slots offer "Önerilen" picks from
  `GET /v1/catalog/slot-suggestions` (`modules/catalog/slot-suggestions.ts`):
  deterministic scoring from catalog popularity, the user's own archived
  projects, pairings with their Library and adoption counted only from three
  users up. Picking one adds the technology to the Library through the
  existing catalog route; an AI ranking is a post-V2 decision.
- At the end of each handoff, update the execution plan and create the exact report
  required by that prompt. Never mark production-ready without a GO decision in
  `docs/44_V1_LAUNCH_GATE.md`.
