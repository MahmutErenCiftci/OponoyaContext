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

## Branches

`dev` is the working branch and holds the complete repository. `main` is the
published subset: it is never merged into, it is regenerated from dev's tree by
`node scripts/sync-main.mjs`, which drops `.claude/`, `AGENTS.md`, `CLAUDE.md`,
`MANIFEST.json`, `docs/`, `marketing/`, `prompts/` and the script itself.

Every change is committed to `dev` first. Only after the local gate run
(`typecheck`, `lint`, `test`, `build`, `verify-bundle`, `test:db`, `test:e2e`) is
green may `main` be regenerated and pushed. Never commit directly on `main`; the
next sync would silently discard it.
