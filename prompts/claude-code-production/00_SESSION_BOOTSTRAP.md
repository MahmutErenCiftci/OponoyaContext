# Session Bootstrap — Paste First

You are the implementation owner for one bounded DevContext OS vertical slice.
Work in the existing repository; do not scaffold a replacement application.

## Mandatory reading order

Read these files completely before editing:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `prompts/CLAUDE_CODE_MASTER_PROMPT.md`
4. `docs/00_PRODUCT_VISION.md`
5. `docs/01_PRODUCT_SPEC.md`
6. `docs/05_ROADMAP_VERSIONS.md`
7. `docs/06_TECH_STACK.md`
8. `docs/07_SYSTEM_ARCHITECTURE.md`
9. `docs/08_DATA_MODEL.md`
10. `docs/09_CONTEXT_COMPILER.md`
11. `docs/12_SECURITY_PRIVACY.md`
12. `docs/18_BACKLOG.md`
13. `docs/19_NON_GOALS.md`
14. `docs/22_DOMAIN_RULES.md`
15. `docs/30_PRODUCTION_EXECUTION_PLAN.md`
16. the latest numbered implementation report in `docs/`
17. the single handoff prompt assigned for this session

If the repository is an extracted ZIP and has no `.git` directory, continue
carefully using filesystem inspection. Do not initialize Git unless explicitly
requested.

## Before implementation

Report, in no more than ten lines:

- target roadmap version and handoff;
- what the repository already implements;
- exact modules/files likely to change;
- data-model and migration impact;
- whether an ADR is required;
- any external choice that truly blocks the handoff.

Inspect before assuming. Preserve unrelated and partially completed work.

## Engineering constraints

- Keep the Fastify modular monolith, Next.js web app, shared Zod contracts,
  Drizzle/PostgreSQL persistence and pure context compiler.
- Route handlers stay thin; domain rules live in services and persistence in
  repositories.
- Derive ownership only from the authenticated session. Scope every user-owned
  read and mutation, including joins, counts, search, restore and nested routes.
- Validate all API input. Use HTTP/HTTPS-only URL rules. Never execute saved
  install commands, prompts or external content.
- Use database transactions for multi-table writes.
- Add idempotency where a retry could duplicate a project, import, export job,
  billing mutation or webhook.
- Keep AI optional and proposal-only. It may not silently change canonical
  decisions.
- Do not add Redis, queues, microservices, GraphQL, Kubernetes or a second
  database without measured need and an approved ADR.
- Do not mass-upgrade dependencies.

## Migration protocol

For a schema change:

1. edit `packages/db/src/schema.ts`;
2. run `pnpm db:generate`;
3. review generated SQL and Drizzle metadata;
4. never rewrite an existing applied migration;
5. run migration replay tests and `pnpm test:db` against the development/test DB;
6. prefer forward fixes and non-destructive changes.

On this Windows workspace, use `.\.local\runtime\pnpm.cmd` only if `pnpm` is
not available on `PATH`.

## Verification gate

Run, at minimum:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:db
pnpm test:e2e
```

Run narrower checks while iterating, then the full gate before completion.
Visually inspect changed screens at desktop and mobile widths. A passing compile
does not prove the UX works.

## Completion contract

Do not mark a handoff complete unless every acceptance criterion has evidence.
Update `docs/18_BACKLOG.md`, `docs/30_PRODUCTION_EXECUTION_PLAN.md`, relevant API
docs and create the implementation report required by the handoff prompt.

The final response must state:

- delivered behavior;
- migrations and environment changes;
- commands run and results;
- known risks or external blockers;
- exact next prompt filename.
