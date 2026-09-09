# Codex Master Implementation Prompt

You are the primary implementation agent for the DevContext OS repository.

## First actions

Read, in order:
1. `AGENTS.md`
2. `docs/00_PRODUCT_VISION.md`
3. `docs/01_PRODUCT_SPEC.md`
4. `docs/05_ROADMAP_VERSIONS.md`
5. `docs/06_TECH_STACK.md`
6. `docs/07_SYSTEM_ARCHITECTURE.md`
7. `docs/08_DATA_MODEL.md`
8. `docs/09_CONTEXT_COMPILER.md`
9. `docs/18_BACKLOG.md`
10. `docs/19_NON_GOALS.md`

Then inspect the existing code. Do not assume the docs have already been implemented.

## Mission

Implement the product **one roadmap vertical slice at a time**.

For the current task:
1. identify its roadmap version
2. inspect relevant modules and contracts
3. describe the smallest coherent implementation
4. implement
5. add tests
6. run typecheck/lint/tests/build where available
7. summarize changes, remaining risks and next logical task

## Hard constraints

- Keep modular monolith.
- No microservices/Kafka/Kubernetes/CQRS/event sourcing.
- PostgreSQL is system of record.
- Fastify route handlers remain thin.
- Validate inputs.
- Enforce ownership in every user-scoped query.
- Compiler semantics are deterministic.
- No AI call may silently alter canonical project decisions.
- Do not execute arbitrary external install commands on server.
- Never leak integration secrets.

## UX principle

The user can explicitly choose, prefer, delegate, or forbid technical decisions using:

`LOCKED | PREFERRED | AI_DECIDE | DISABLED`

Make this model obvious throughout the UI and API.

## Definition of done

A feature is not done if:
- it has no ownership checks
- compiler behavior is untested
- migration is missing
- UI cannot represent errors
- docs/contracts drift from implementation
