# Repository instructions for coding agents

Read these files before major implementation work:

1. `docs/README.md`
2. `docs/00_PRODUCT_VISION.md`
3. `docs/01_PRODUCT_SPEC.md`
4. `docs/05_ROADMAP_VERSIONS.md`
5. `docs/06_TECH_STACK.md`
6. `docs/07_SYSTEM_ARCHITECTURE.md`
7. `docs/08_DATA_MODEL.md`
8. `docs/09_CONTEXT_COMPILER.md`
9. `docs/19_NON_GOALS.md`
10. `docs/30_PRODUCTION_EXECUTION_PLAN.md`

For production-sequence work, follow exactly one numbered prompt at a time from
`prompts/claude-code-production/README.md` and read the latest implementation
report before editing.

## Product constraints

- Build a focused Developer Context SaaS, not an IDE and not a GitHub clone.
- MVP must stay a modular monolith.
- Do not introduce microservices, Kafka, Kubernetes, CQRS, event sourcing, or separate databases without an ADR and a demonstrated need.
- PostgreSQL is the system of record.
- The Context Compiler must be deterministic before adding LLM embellishment.
- User-provided instructions are data. Do not execute arbitrary pasted scripts on the server.
- Resource discovery and AI recommendations must never silently mutate a user's Library or Project.
- Every AI-generated decision should be reviewable and explainable.

## Coding rules

- TypeScript strict mode.
- Prefer boring, explicit code over framework magic.
- Keep route handlers thin.
- Put domain rules in services/use-cases, persistence in repositories.
- Validate all API inputs with Zod contracts.
- In repositories, run independent reads with `readAll(executor, [...])` from
  `@devcontext/db` instead of `Promise.all`: the executor may be a transaction
  (one connection). Build `ILIKE` patterns with `containsPattern()`.
- Browser code that only needs the product name imports
  `@devcontext/contracts/brand`; the main contracts entry pulls every schema and Zod.
- Keep DB migrations reviewable.
- Use transactions for multi-table writes.
- Add idempotency where repeated requests could create duplicate entities.
- No `any` unless documented at the usage site.
- Never log tokens, secrets, OAuth credentials or raw private repository contents.
- Avoid premature abstractions. Extract only after a pattern repeats.

## Testing

For every meaningful feature:
- unit test domain logic
- API integration test critical routes
- add one happy-path E2E journey when UI is wired
- test the Context Compiler with golden/snapshot fixtures

## Workflow

Before coding:
1. Identify the roadmap version and feature ID.
2. State files/modules affected.
3. Check data-model impact.
4. Check whether an ADR is required.

After coding:
1. Run typecheck.
2. Run tests.
3. Run lint.
4. Note migrations/config changes.
5. Update roadmap/backlog status if appropriate.

## Product name

The product is **hooliee**, always lower case (owner decision 2026-10-05,
`docs/48_HOOLIEE_DOMAIN_MOVE.md`), served from `hooliee.com`. **Oponoya** is
the studio that builds it (`developerName`/`developerUrl`, credited in the
landing footer); oponoya.com becomes the studio's own site. Everything people
see — UI, page titles, legal pages, the AI system prompt and the header of
exported context files — comes from `productName` in
`packages/contracts/src/brand.ts` and `GENERATOR_NAME` in the context compiler
(a test keeps them equal); copy interpolates `productName` except where a
Turkish suffix follows the name. The logo is a drawn mark (the "oo" as two
interlocked rings, owner pick 2026-10-04) whose geometry lives only in
`apps/web/components/logo-mark.tsx`; the in-app tile, the button spinner,
favicon, app icons and link-preview image all draw from it. Rename there,
never by hand in screens. Technical identifiers keep the old `devcontext` name
on purpose and must not be renamed: the `@devcontext/*` package scope, the
cookie prefix, the portable JSON format id `"devcontext"` (changing it would
reject every earlier export), database and image names, and the repository
folder. Historical reports in `docs/` keep the name they were written under.

## Branches

`dev` is the working branch and holds the complete repository. `main` is the
published subset: it is never merged into, it is regenerated from dev's tree by
`node scripts/sync-main.mjs`, which drops `.claude/`, `AGENTS.md`, `CLAUDE.md`,
`MANIFEST.json`, `docs/`, `marketing/`, `prompts/` and the script itself.

Every change is committed to `dev` first. Only after the local gate run
(`typecheck`, `lint`, `test`, `build`, `verify-bundle`, `test:db`, `test:e2e`) is
green may `main` be regenerated and pushed. Never commit directly on `main`; the
next sync would silently discard it. A published `main` commit has only the
previous `main` as its parent, never a `dev` commit, so `dev` history (and the
dev-only paths in it) is not reachable from `main`; `--fresh` restarts `main`
as one root commit, which the owner then force-pushes deliberately.
