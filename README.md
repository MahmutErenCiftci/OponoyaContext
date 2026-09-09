# DevContext OS — AI-Native Developer Workspace

> Working name only. Rename before launch.

DevContext OS is a SaaS for developers and AI-native builders who want one place to store **how they build software**: technologies, frameworks, databases, components, themes, animations, repositories, templates, prompts, AI tools, architectural preferences, deployment choices, and reusable rules.

The product turns that personal/team development system into project-specific context for coding agents such as Codex, Claude Code, Cursor and GitHub Copilot.

## Core promise

**Stop re-explaining your stack to AI.**

The product is not a bookmark manager, not a code-hosting platform, not a BaaS, and not an IDE. It is a **Developer System of Record + Project Blueprint Builder + Context Compiler**.

## Primary product loop

1. **Discover** a resource.
2. **Save** it to your Library.
3. Describe how you want it used: `LOCKED`, `PREFERRED`, `AI_DECIDE`, or `DISABLED`.
4. Combine resources into Stack Presets, Design Profiles, AI Profiles, and Recipes.
5. Create a Project through a guided stack wizard.
6. Override project-level decisions.
7. Generate live project context.
8. Export context for Codex / Claude Code / Cursor / Copilot.
9. Change the stack later; regenerate context and show affected decisions.

## MVP north star

A developer should be able to go from:

> "I want a Next.js SaaS, use my normal UI components and design profile, let AI decide the low-level backend details."

to a clean, reusable set of project instructions in **under five minutes**.

## Repository layout

```text
apps/
  web/                  Next.js product UI
  api/                  Fastify API
packages/
  contracts/            Zod request/response contracts
  db/                   Drizzle + PostgreSQL schema
  context-compiler/     Core rule-merging + export engine
  catalog/              Read-only technology catalog compiled from data/catalog
data/catalog/           Technology, stack, AI-readiness and velocity research (JSON)
docs/                   Product, architecture and roadmap
prompts/                Master prompts for coding agents
examples/               Example generated project context
```

The web app ships brand marks for the catalog under `apps/web/public/logos`
(Simple Icons, CC0-1.0; trademarks belong to their owners). Refresh them with
`node scripts/fetch-logos.mjs` after editing `data/catalog`. The UI has dark and
light themes; the choice is stored in the `devcontext-theme` cookie.

## Recommended implementation order

Do **not** build every planned feature at once.

Start with:
- authentication
- Library
- Project Wizard
- Project Stack editor
- decision modes
- Context Compiler
- Codex/Claude/Cursor exports

Then ship to real users.

Read `docs/README.md` and `docs/05_ROADMAP_VERSIONS.md` before coding. For the
production sequence, run one prompt at a time from
`prompts/claude-code-production/README.md`.

Current dependency/version notes: `docs/26_SOURCES_AND_VERSION_NOTES.md`.

## Local development

Prerequisites (updated at the owner's request, 2026-09-07):
- Node.js 26.8.1 (Current stable)
- pnpm 12.3.4
- Docker Compose for PostgreSQL 18.6, or an existing PostgreSQL instance

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` creates `.env` from `.env.example` only if missing, waits for PostgreSQL,
applies committed migrations, builds shared packages, then starts the web (3000)
and API (4000). Existing `.env` values are preserved; process environment values
take precedence. PostgreSQL stays running when the app is stopped.

With an existing database, copy `.env.example` to `.env`, set `DATABASE_URL`, then
run `pnpm db:migrate` and `pnpm dev:apps`. The API binds to loopback by default;
set `API_HOST=0.0.0.0` for a container. The web's `API_URL` is server-only.
Production requires HTTPS `BETTER_AUTH_URL`/`CORS_ORIGIN` and an explicit
`BETTER_AUTH_SECRET`; set `TRUST_PROXY=true` only behind a load balancer that
rewrites `X-Forwarded-For`. `LOG_LEVEL` overrides the per-environment default.
`BILLING_PROVIDER` is `none` by default (everyone on the Free plan, no upgrade
path); `fake` enables the in-process test provider for development and requires
`BILLING_WEBHOOK_SECRET`; the real adapter is an external activation step (see
`docs/40_BILLING_HANDOFF.md`).

On this Windows workspace, downloaded Node/pnpm binaries can be used without a
global installation: `./scripts/pnpm-local.ps1 dev`. If the prepared portable
PostgreSQL cluster exists under `.local`, `pnpm dev` uses it instead of Docker.
Those binaries and database files are local, ignored artifacts and are not shipped
in source control. A fresh checkout uses the prerequisites above.

Checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:db
```

`pnpm test` includes isolated PostgreSQL-engine migration/constraint checks, the
backup/restore round trip and API repository tests using PGlite
(`@devcontext/db/testing`). `pnpm test:db` requires `DATABASE_URL` and runs
against an actual PostgreSQL server: it replays migrations on that database and
creates a throwaway scratch database for the destructive drills (restore,
concurrent compiles/exports/clones). CI provisions PostgreSQL 18.6, audits
dependencies, verifies migration drift and runs all checks.

Backups (development/test drill; production uses managed snapshots):

```bash
pnpm db:backup --out backups/before-change.json
pnpm db:verify --file backups/before-change.json
pnpm db:restore --file backups/before-change.json --yes
```

For a schema change: edit `packages/db/src/schema.ts`, run `pnpm db:generate`,
review and commit **both SQL and drizzle/meta**, then run `pnpm db:migrate`.
Never regenerate existing migrations to change an already deployed database.

V0.0 foundation, V0.1 authentication, the Resource Library, Minimal Projects
(project wizard, archive/restore, Library attachments) and Project decisions
(DecisionControl, Stack screen, Library inheritance) the deterministic
compiler with persisted versions and exports (master prompt, AGENTS.md,
CLAUDE.md, Cursor, Copilot), reusable Profiles, the ten-step Project composer, the V0.3
usability layer (search palette, favorites, duplicate evidence, compatibility
warnings, clone, semantic diff, onboarding), the V0.3 reliability layer
(origin guard, rate limits, redacted structured logs, audit trail, error
boundaries, backup/restore drill) and the V1 activation slice (Recipes with
inheritance, first-run choices, optional sample data, portable JSON
export/import, zipped context bundles) are implemented. Handoff 10 (billing and
entitlements) is next. See the
[foundation report](docs/27_FOUNDATION_HANDOFF.md),
[authentication report](docs/28_AUTHENTICATION_HANDOFF.md),
[Resource Library report](docs/29_RESOURCE_LIBRARY_HANDOFF.md),
[current-state audit](docs/31_CURRENT_STATE_AUDIT.md),
[Projects report](docs/32_PROJECTS_HANDOFF.md),
[Decisions report](docs/33_DECISIONS_HANDOFF.md),
[Compiler and exports report](docs/34_COMPILER_EXPORTS_HANDOFF.md),
[Composer and profiles report](docs/35_COMPOSER_HANDOFF.md),
[V0.3 usability report](docs/36_V0_3_USABILITY_HANDOFF.md),
[V0.3 reliability report](docs/37_V0_3_RELIABILITY_HANDOFF.md),
[V1 portability report](docs/38_V1_PORTABILITY_HANDOFF.md) and
[backlog](docs/18_BACKLOG.md).
