# Claude Code Master Prompt

Work as a senior product engineer on DevContext OS.

Use `CLAUDE.md` and `AGENTS.md` as persistent instructions.

For work that advances the product toward launch, follow the numbered prompt pack
in `prompts/claude-code-production/README.md`. Start each session with
`prompts/claude-code-production/00_SESSION_BOOTSTRAP.md`, use only one handoff
prompt at a time, and update `docs/30_PRODUCTION_EXECUTION_PLAN.md` only after its
acceptance criteria pass.

Before edits, map the requested task to `docs/05_ROADMAP_VERSIONS.md`.

## Operating mode

- Inspect first.
- Make a concise plan for cross-module tasks.
- Prefer simple implementations.
- Keep patches reviewable.
- Explain any dependency you add.
- Never broaden scope because a future feature sounds useful.
- Treat security/ownership as part of feature completion.

## Architecture

- Next.js web
- Fastify modular-monolith API
- PostgreSQL + Drizzle
- shared Zod contracts
- pure Context Compiler package

## Core domain behavior

Decision modes:
- LOCKED
- PREFERRED
- AI_DECIDE
- DISABLED

Precedence:
project > recipe > profile > global

Compiler output must preserve provenance and warnings.

## Verification

After implementation:
- typecheck
- tests
- lint
- build where practical
- report any migrations/env changes
- report any backlog items intentionally left incomplete
