# Handoff 6 — Deterministic Compiler, Versions and Exports

Use this after Project decisions are complete.

## Target

Connect authenticated database inputs to the pure Context Compiler, persist
canonical versions and expose trustworthy preview/download exports.

## Compiler rules

- The canonical object is created before any format-specific output.
- Precedence is `project > recipe > profile > global`; profile/recipe inputs may
  be empty until Handoff 7, but the compiler contract must already support them.
- Preserve winning-source provenance and shadowed lower-precedence decisions.
- `AI_DECIDE` renders deliberate delegation and may have no Resource.
- `DISABLED` becomes a negative instruction and is not active stack content.
- Include exact saved component/reference URLs and attached Project Resources.
- Sort deterministically. Same canonical input plus compiler version must produce
  byte-stable canonical JSON and hashes.
- Compatibility warnings never mutate input decisions.

## Persistence and API

- Query all currently available Project, Resource, global and Project-decision
  inputs with owner-scoped repositories.
- Compile inside an application service; keep the pure package independent of
  Fastify and PostgreSQL.
- Persist `compilerVersion`, canonical JSON, content hash and monotonic Project
  version. Do not create a new version when the hash is unchanged.
- Make concurrent compile requests safe using a transaction/advisory or locking
  strategy appropriate to PostgreSQL.
- Implement authenticated compile/current/version-history/version-detail routes.
- Record successful export events idempotently without storing secrets.

## Export adapters

Adapters consume only canonical context. Implement and test:

- generic master prompt Markdown;
- `AGENTS.md`;
- `CLAUDE.md`;
- Cursor `.mdc` rule;
- Copilot instructions.

Adapters may change formatting, never semantics.

## Web

- Add Project Context screen with clean/warning status, compile action, current
  version, version history and canonical JSON view.
- Add target tabs with safe text preview, copy and download actions.
- Show stale/archived Resource warnings without silently rewriting decisions.
- Treat copied/exported text as data; never render untrusted HTML.

## Tests

- golden fixtures for global only, Project override, AI Decide, Disabled,
  component preference, recipe placeholder, conflict warning and deterministic
  ordering;
- duplicate-hash version suppression and concurrent version numbering;
- authenticated ownership for compile/history/export;
- exporter semantic parity and exact component URLs;
- Playwright Library → Project → decisions → compile → preview/download.

## Acceptance criteria

- a real Project generates useful stable instructions;
- previous versions remain readable after Resource archive/edit;
- identical input does not create version noise;
- every exporter preserves canonical meaning;
- full verification gate passes.

## Deliverable

Update compiler/API/backlog/execution docs and create
`docs/34_COMPILER_EXPORTS_HANDOFF.md`. End it with:

`Next prompt: prompts/claude-code-production/05_H07_COMPOSER_PROFILES.md`
