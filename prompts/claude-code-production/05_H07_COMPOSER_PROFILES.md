# Handoff 7 — V0.2 Project Composer and Profiles

Use this after the first persisted compiler/export flow is complete.

## Target

Complete the V0.2 private-beta composition model: reusable Stack/Design/AI/
Deployment Profiles, full wizard decision coverage, deterministic inheritance and
review UX. Full Recipes are V1.0 work and stay out of this handoff.

## Domain and persistence

- Implement owner-scoped CRUD for Profile types `stack`, `design`, `ai` and
  `deployment`.
- Support Profile decisions using the same Decision payload and validation as
  Project decisions.
- Projects may attach multiple Profiles with explicit priority.
- Preserve real foreign keys; do not introduce polymorphic scope IDs.
- Resolve same-slot Profile conflicts deterministically by explicit priority,
  with newest revision only as final tie-breaker.
- Keep Recipe inputs empty but supported by compiler types so V1.0 can add them
  without changing canonical semantics.

## Compiler

- Activate precedence `Project > Profile > Global` while retaining the reserved
  Recipe layer between Project and Profile.
- Retain provenance and every shadowed decision needed for explanation.
- Add golden cases for multiple Profile priority and Project override.
- Bump compiler version only if semantics or deterministic output change, and
  document the change.

## Project Composer UX

Evolve the wizard with progressive disclosure:

1. basics;
2. frontend;
3. backend;
4. data;
5. identity/storage;
6. UI/design;
7. AI development;
8. infrastructure;
9. rules;
10. review.

Requirements:

- allow skip/delegate with AI Decide wherever reasonable;
- search and choose saved Library Resources;
- show inherited Global/Profile decisions in a persistent summary;
- support Low/Balanced/High freedom presets only as visible initializers;
- never force low-value tiny decisions during creation;
- surface warnings without automatic replacement;
- save partial wizard progress safely or make navigation loss explicit.

## Tests

- CRUD and cross-user ownership for Profiles;
- deterministic multi-scope precedence/provenance golden tests;
- Profile foreign-resource rejection;
- wizard persistence and review summary;
- Playwright creates two Projects from shared Profiles with different Project
  overrides and confirms their compiled outputs differ without duplicated setup.

## Acceptance criteria

- a user reuses base context across two Projects;
- every effective choice explains its source;
- same-slot conflicts are deterministic and visible;
- all four modes remain consistent across scopes;
- full verification gate passes.

## Deliverable

Update docs/backlog/execution plan and create `docs/35_COMPOSER_HANDOFF.md`.
End it with:

`Next prompt: prompts/claude-code-production/06_H08A_V0_3_USABILITY.md`
