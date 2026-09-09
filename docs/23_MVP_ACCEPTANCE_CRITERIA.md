# 23 — MVP Acceptance Criteria

The MVP is ready for external beta only if all are true.

## Library
- user can save an exact external component URL
- user can set it Preferred
- user can search it later
- user can edit/disable/archive it

## Project
- user can create project
- user can choose frontend/backend/database
- user can leave at least one slot AI Decide
- user can attach saved component
- user can override inherited preference

## Compiler
- global + profile + project precedence works
- AI Decide rendered correctly
- Disabled rendered as negative instruction
- exact saved component reference included
- compiler output deterministic
- version stored
- previous version viewable

## Export
- AGENTS.md
- CLAUDE.md
- Cursor rule
- generic master prompt

## Security
- authenticated ownership
- user isolation integration tests
- no arbitrary URL fetching in MVP unless SSRF-safe implementation exists
- no secrets logged

## Reliability
- DB backup
- error monitoring
- migrations reviewed
- basic E2E passes

## Product validation
At least 5 external developers complete:
Library → Project → Export
without founder intervention.
