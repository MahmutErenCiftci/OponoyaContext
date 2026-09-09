# 05 — Versioned Development Plan

The roadmap is intentionally staged to avoid building a giant developer portal before validating the core loop.

---

# V0.0 — Foundation / Repository bootstrap

Goal: runnable architecture and engineering contracts.

Deliver:
- monorepo
- Next.js shell
- Fastify API
- PostgreSQL + Drizzle
- shared Zod contracts
- health endpoint
- test/lint/typecheck setup
- CI skeleton
- auth spike
- ADRs

Exit criteria:
- local environment starts with one command
- DB migration works
- API reachable from web
- CI passes

---

# V0.1 — Library Alpha

Goal: prove structured developer-memory model.

Features:

## Authentication
- email/password or magic-link minimum
- protected app routes

## Resource Library
- create resource
- edit resource
- archive resource
- list/search
- tags
- type
- source URL
- docs URL
- repo URL
- install command
- notes

## Preference rule
Allow user to define global usage:
- LOCKED
- PREFERRED
- DISABLED

`AI_DECIDE` is represented at project slot level.

## Minimal Projects
- create project
- project title/description
- manually attach resources

## First compiler
- generic markdown output
- `AGENTS.md` output

Do not build:
- Discover
- AI recommendations
- GitHub analysis
- billing
- teams

Exit criteria:
A real developer can save 20 resources and produce useful project instructions.

---

# V0.2 — Project Composer Private Beta

Goal: make project creation the primary product experience.

## Project Wizard
- basics
- frontend
- backend
- database
- auth/storage
- UI/design
- AI development
- infrastructure
- rules
- review

## Decision modes
Full support:
- LOCKED
- PREFERRED
- AI_DECIDE
- DISABLED

## Presets
- stack presets
- basic design profiles

## Context Compiler v1
Precedence:
1. global defaults
2. selected profiles/presets
3. recipe (if any)
4. project decisions
5. explicit project overrides

## Exports
- generic master prompt
- AGENTS.md
- CLAUDE.md
- Cursor `.mdc`

## Context versions
Store canonical compiled JSON + hashes.

Exit criteria:
A user can build two projects using different stacks without duplicating their base preferences.

---

# V0.3 — Usability / Reliability Beta

Goal: make the core loop trustworthy.

- fast global search
- favorites
- better filters
- duplicate-resource detection
- compatibility rule table
- project impact warnings
- context diff
- export preview
- project cloning
- save project as preset/recipe
- audit trail for major changes
- onboarding
- analytics events
- error monitoring
- rate limiting
- backup/restore tests

Exit criteria:
No known data-loss path; compiler output is stable and explainable.

---

# V1.0 — Public Launch

Goal: paid individual product.

Must include:
- polished Library
- Project Wizard
- profiles/recipes
- project stack editor
- context versions/diff
- Codex/Claude/Cursor/Copilot exports
- billing
- Free + Pro plan enforcement
- basic import/export
- privacy controls
- delete account/data
- production observability
- landing/pricing/docs

Recommended initial pricing:
- Free
- Pro monthly
- Pro annual

Do not launch Team plan yet unless users request it.

---

# V1.1 — Integrations

- GitHub OAuth connection
- save/import public repo metadata
- optional private repo selection with minimal scopes
- repository export helper
- one-click generated context bundle
- import existing AGENTS.md / CLAUDE.md
- import Cursor rules
- import Copilot instructions

Important:
Never ingest private source code broadly by default.

---

# V1.2 — Discover

Goal: turn Library into a growing developer knowledge graph.

- curated catalog
- categories
- trending/new
- Save to Library
- Try in Project
- compatibility indicators
- personal "For You"
- submit resource
- moderation/admin tooling

Start curated; do not attempt to index all GitHub.

---

# V1.5 — AI Intelligence

Goal: add AI where deterministic rules are insufficient.

- URL metadata enrichment
- repo summary
- resource classification
- dependency/compatibility suggestions
- stack recommendation
- AI Decide proposals
- explain "why this choice"
- prompt cleanup
- stale-resource warning

Rules:
- AI proposes; user controls.
- AI cannot silently rewrite projects.
- cache enrichment results.
- use quotas/credits.

---

# V1.7 — Developer Capture Tools

- browser extension: save current resource
- VS Code / editor companion
- quick add via command palette
- project context sync helper
- CLI:
  - login
  - list projects
  - export context
  - pull context bundle

---

# V2.0 — Team / Company Engineering Context

Goal: B2B expansion.

- organizations/workspaces
- seats
- roles
- shared Library
- approved resources
- enforced/optional team rules
- company stack profiles
- internal components/design systems
- audit history
- team context export
- private resource catalog
- SSO later
- SCIM later

Do not mix team permission complexity into V1 data access prematurely. Design IDs/ownership fields now, implement later.

---

# V2.5+ — Platform possibilities

Only after proven demand:
- MCP server exposing project context
- API/SDK
- agent-to-agent context access
- automatic existing-codebase stack detection
- migration assistant
- dependency upgrade recommendations
- organization policy checks
- public community stacks
- marketplace

These are options, not commitments.

---

# Execution mapping

Roadmap scope is not implementation status. Current verified status lives in
`docs/30_PRODUCTION_EXECUTION_PLAN.md`.

Use the Claude Code production prompt pack one vertical slice at a time:

- V0.0: Handoff 1 plus current-state audit
- V0.1: Handoffs 2–6
- V0.2: Handoff 7
- V0.3: Handoffs 8A–8B
- V1.0: Handoffs 9–13

The exact prompts and acceptance gates are indexed in
`prompts/claude-code-production/README.md`. V1.2 Discover, V1.5 AI and V2 Team
work must not be pulled into the production-launch sequence without an explicit
scope decision.
