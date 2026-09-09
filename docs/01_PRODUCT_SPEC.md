# 01 — Product Specification

## Primary users

### A. AI-native solo developer
Uses Codex / Claude Code / Cursor heavily and starts many projects.

Needs:
- fast project setup
- reusable stack choices
- consistent coding-agent instructions
- component/theme memory

### B. Full-stack developer
Knows exactly what they want for some layers but wants AI to choose low-level details.

Needs:
- `LOCKED` + `AI_DECIDE`
- compatibility warnings
- project overrides

### C. Design-heavy frontend developer
Has favorite themes, v0 templates, shadcn registries, animation libraries and exact components.

Needs:
- component-level preferences
- design profiles
- source URLs/install instructions
- "use this instead of custom implementation"

### D. Team lead / engineering manager (later)
Needs:
- team-approved resources
- enforced rules
- company stack profiles
- audit history
- role-based access

## Domain objects

### Resource
Any reusable development item.

Resource types:
- language
- framework
- runtime
- database
- ORM/query layer
- auth
- storage
- cache
- queue
- UI library
- component
- theme
- design system
- animation library
- icon library
- repository
- boilerplate
- template
- prompt
- AI coding tool
- AI builder
- MCP server
- CLI
- deployment target
- monitoring tool
- API/service
- architecture pattern
- coding rule
- documentation/reference

### Resource metadata

Minimum:
- name
- slug
- type
- source URL
- description
- tags
- ownership (`system`, `user`, later `team`)
- visibility
- status
- notes

Optional:
- repository URL
- docs URL
- install command
- license
- framework compatibility
- dependencies
- conflicts
- versions
- screenshots
- examples
- AI-generated summary

### Preference / Decision

A resource can be attached to a scope with one of four modes:

- `LOCKED` — must use
- `PREFERRED` — prefer unless there is a concrete reason not to
- `AI_DECIDE` — no fixed implementation; coding agent may choose within constraints
- `DISABLED` — do not use

Decision fields:
- scope
- category/slot
- resource
- mode
- priority
- constraints
- rationale
- conditions
- notes

Examples:
- UI base → shadcn/ui → LOCKED
- Toggle → Animate UI Radix Toggle → PREFERRED
- Backend framework → null → AI_DECIDE
- Redis → Redis → DISABLED

### Profile

Reusable group of decisions:
- Stack Preset
- Design Profile
- AI Profile
- Deployment Profile

### Recipe

A higher-level reusable blueprint combining profiles + selected resources + rules.

Example:
`Fast SaaS MVP`
- Next.js
- shadcn
- preferred saved components
- PostgreSQL
- Better Auth
- Cloudflare R2
- Codex profile
- MVP architecture rules

### Project

Contains:
- identity and description
- lifecycle stage
- expected scale
- priorities
- selected profiles/recipe
- project-level decisions
- saved project resources
- generated context versions
- export history

## New Project Wizard

### Step 1 — Project basics
- name
- description
- product type
- platform
- MVP / production / experiment
- expected user/load range
- budget priority
- speed vs flexibility vs scale

### Step 2 — Frontend
- language
- framework
- rendering mode (advanced)
- state/query tools (advanced)
- decision mode

### Step 3 — Backend
- language
- framework
- API style
- architecture
- decision mode per slot

### Step 4 — Data
- database
- ORM/query layer
- cache
- search/vector
- queue
- optional services

### Step 5 — Identity/storage
- auth
- organization/multi-tenant need
- file storage
- email/provider

### Step 6 — UI/design
- UI foundation
- design profile
- exact preferred components
- icon library
- theme
- animation
- 3D

### Step 7 — AI development
- primary coding agent
- UI builder
- saved prompt/templates
- AI freedom level

### Step 8 — Infrastructure
- hosting/deployment
- containerization
- CI/CD
- observability

### Step 9 — Rules
- engineering rules
- forbidden technologies
- custom instructions

### Step 10 — Review
Show:
- locked choices
- preferred choices
- delegated choices
- disabled choices
- compatibility warnings

Then create the Project.

## AI freedom presets

### Low
Most slots should be explicit.

### Balanced
User locks important platform choices. Agent decides implementation details.

### High
User provides product constraints. AI proposes most technical choices for review.

These presets only initialize modes. The final per-slot modes are always visible and editable.

## Project workspace navigation

- Overview
- Stack
- Components
- Design
- Resources
- Rules
- Architecture
- AI Context
- Exports
- History

## Context generation

The product must produce a **canonical context object first**.

Then exporters render:
- generic Master Prompt
- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/*.mdc`
- `.github/copilot-instructions.md`

Do not make each exporter independently reason about the project.

## Important UX principle

Never force the user to configure tiny decisions such as date libraries during project creation.

Use progressive disclosure:
- core stack first
- advanced options collapsed
- `AI_DECIDE` available everywhere reasonable
