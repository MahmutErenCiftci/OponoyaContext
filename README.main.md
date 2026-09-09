# DevContext OS — AI-Native Developer Workspace

> Working name only. Rename before launch.

DevContext OS is a SaaS for developers and AI-native builders who want one place to store **how they build software**: technologies, frameworks, databases, components, themes, animations, repositories, templates, prompts, AI tools, architectural preferences, deployment choices, and reusable rules.

The product turns that personal/team development system into project-specific context for coding agents such as Codex, Claude Code, Cursor and GitHub Copilot.

> This is the `main` branch: product code, tests, deployment and CI only.
> Product documentation, architecture notes, agent prompts and marketing assets
> live on `dev`, which holds the complete repository.

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
deploy/                 Compose stack and environment templates
e2e/                    Playwright journeys
examples/               Example generated project context
scripts/                Development, smoke, backup and bundle-guard tooling
```

The web app ships brand marks for the catalog under `apps/web/public/logos`
(Simple Icons, CC0-1.0; trademarks belong to their owners). Refresh them with
`node scripts/fetch-logos.mjs` after editing `data/catalog`. The UI has dark and
light themes; the choice is stored in the `devcontext-theme` cookie.

## Local development

Prerequisites:
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
`BILLING_WEBHOOK_SECRET`; the real adapter is an external activation step.

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

## Operations

Deployment images are `apps/*/Dockerfile`; the staging stack is
`deploy/compose.staging.yml` with the templates under `deploy/env/`. Migrations
run as a release step, never on boot. `/health` and `/ready` back the rollout —
`/ready` answers 503 while the process drains. Evidence tooling:

```bash
node scripts/smoke.mjs           # post-deploy journey against a running stack
node scripts/restore-drill.mjs   # snapshot -> scratch restore -> checksums
node scripts/verify-bundle.mjs   # client bundle carries no server-only names
```

Secrets are never committed. `deploy/env/ci.env` is throwaway configuration for
the local and CI container smoke test and contains no real secret.

## Status

V1.0 code is complete and covered by 198 unit/integration tests plus 13
Playwright journeys. The V1.0 launch gate is **BLOCKED** — not on any code or
configuration defect, but on items only the owner can supply: hosting and
managed PostgreSQL, DNS/TLS, a monitoring destination, and legal values and
approval. Launch mode is a free beta (`BILLING_PROVIDER=none`).

**This product is not production-ready.** The gate must be re-run with staging
evidence and return GO first. The gate document and the numbered implementation
reports are on the `dev` branch under `docs/`.

## License

See [LICENSE](LICENSE).
