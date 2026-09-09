# 26 — Source & Version Notes

Checked: 2026-09-07. The owner requested the newest stable versions, including major upgrades. This supersedes the original ZIP baseline. Direct dependencies are pinned in package.json and pnpm-lock.yaml.

| Component | Version |
| --- | --- |
| Node.js | 26.8.1 (Current stable) |
| pnpm | 12.3.4 |
| Next.js / eslint-config-next | 16.3.4 |
| React / React DOM | 19.2.8 |
| Fastify / CORS | 5.12.3 / 11.3.0 |
| PostgreSQL | 18.6 |
| Drizzle ORM / Kit | 0.45.2 / 0.31.10 |
| node-postgres | 8.23.0 |
| Better Auth | 1.7.3 (authentication integration complete) |
| Zod | 4.5.4 |
| TypeScript compiler | 7.0.2 |
| TypeScript tooling API compatibility | @typescript/typescript6 6.0.2 |
| Vitest / Playwright | 5.0.0 / 1.63.0 |
| ESLint / typescript-eslint | 10.10.0 / 8.69.0 |
| ESLint compatibility utilities | 2.1.1 |
| Turborepo | 2.10.12 |
| PGlite (tests only) | 0.5.8 |

Versions were retrieved from the npm registry's latest tag. PostgreSQL 19 is still beta; 18.6 is the latest stable release. Prereleases were not selected.

## Major-version adaptations

- `tsc` runs TypeScript 7 through the `@typescript/native` npm alias. The `typescript` alias supplies Microsoft's TypeScript 6 API compatibility package for Next.js/ESLint, following Microsoft's side-by-side migration instructions. Package build/typecheck commands use the version 7 compiler.
- ESLint 10 uses flat configuration and `@eslint/compat` for Next/React rules. The parser is explicitly the current typescript-eslint parser; the Next-bundled Babel scope manager is incompatible with ESLint 10.
- Vitest 5 uses current entrypoints and isolated mocks. No removed runner APIs are used.
- Fastify uses the current `LogController` API. Logs exclude raw query strings, bodies and error objects that may contain private data.
- PostgreSQL 18 Docker volumes mount `/var/lib/postgresql`.
- CI actions were checked against upstream latest releases: checkout 7.0.1, setup-node 7.0.0, upload-artifact 7.0.1, pnpm/action-setup 6.0.10.

## Known upstream peer metadata

Some Next-provided React/import/accessibility plugins still declare ESLint <=9. The official compatibility wrapper adapts them and the full lint run validates the configured rules. Better Auth 1.7.3 declares optional Vitest <=4 support; its testing adapter is not imported. Authentication is verified with the repository's Vitest 5 API tests and Playwright flow. Warnings are retained rather than hidden with blanket peer overrides.

## Sources

- [Node 26.8.1](https://nodejs.org/en/blog/release/v26.8.1)
- [TypeScript 7 and side-by-side API compatibility](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [Vitest 5 migration](https://main.vitest.dev/guide/migration)
- [ESLint 10 release](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)
- [PostgreSQL 18.6](https://www.postgresql.org/docs/current/release-18-6.html)
- [EDB Windows binaries](https://www.enterprisedb.com/download-postgresql-binaries)
- [PostgreSQL image data directories](https://hub.docker.com/_/postgres)
- [Drizzle migration generation](https://orm.drizzle.team/docs/drizzle-kit-generate)

Before production, review current security notices and complete the numbered
beta/production gates. CI runs `pnpm audit --audit-level=high` on every push and
weekly; as of 2026-09-07 the only advisory is a moderate, development-only
esbuild issue (GHSA-67mh-4wv8-2f99) reached through drizzle-kit's TypeScript
loader, which never runs a dev server here. Foundation, authentication, the
Resource Library, Projects, decisions, the compiler with exports, Profiles, the
V0.2 composer, V0.3 usability, V0.3 reliability and the V1 activation slice
(Recipes, onboarding, samples, portable export/import, bundles) are implemented;
Handoff 10 (billing and entitlements) is next. The authoritative ledger is
`docs/30_PRODUCTION_EXECUTION_PLAN.md`.
