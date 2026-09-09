# 21 — UI Screen Blueprint

> Historical outline. Since report 41 the implemented layout follows the
> design pack in `../claude-ui-handoff` (27 reference screens: horizontal top
> navigation instead of a filter rail, right-hand drawers, a four-step
> full-page project wizard). See `docs/41_HYBRID_UI_HANDOFF.md` for the
> screen-to-file map; the information architecture below still applies.

## Dashboard

Top:
- greeting / create project CTA
- recent projects
- context compile activity

Secondary:
- recently saved resources
- recommended additions (later)
- setup completeness

Avoid giant vanity charts.

## Library list

Left/filter rail or command palette:
- resource type
- tag
- preferred/disabled
- source
- project usage

Main rows:
- name
- type
- preference badge
- tags
- projects using
- quick actions

Primary actions:
- Add Resource
- Import
- Create Profile from selection

## Add Resource drawer/modal

Fields:
1. URL (optional)
2. Name
3. Type
4. Slot/category
5. Usage mode
6. Tags
7. install command
8. notes
9. advanced metadata

After URL paste, later enrichment may suggest values, but user confirms.

## New Project Wizard

Persistent right-side summary on desktop:

```text
PROJECT SUMMARY

Frontend
Next.js        LOCKED
shadcn         LOCKED
Toggle         Animate UI PREFERRED

Backend
Language       TypeScript
Framework      AI DECIDE

Database
PostgreSQL     LOCKED
```

Every step supports:
- skip/delegate
- search saved Library
- add new resource inline

## Project Stack

Group by layer.

Each row:
- slot
- mode
- selected resource / AI Decide
- inherited-from badge
- change action

Click opens Decision Editor.

## Decision Editor

Show:
- current mode
- selected resource
- constraints
- rationale
- inheritance
- impacted slots
- compatibility warnings

## Context page

Top:
- status: clean / warnings
- current version
- compile button
- target selector

Tabs:
- Master
- AGENTS
- CLAUDE
- Cursor
- Copilot
- Canonical JSON
- Diff

## Context diff

Compare:
- decision added
- changed mode
- changed resource
- removed
- warning changed

Do not show only raw markdown diff; include semantic decision diff.

## Catalog (report 39)

- header: count of technologies and presets, research date, the sentence that
  scores are editor assessments, link to the Library
- stack preset strip: name, summary, team size, time to MVP, technology count,
  two separate meters (prototype speed, production readiness)
- domain chips with counts; the security and Türkiye notes appear when chosen
- search (diacritic-insensitive), type filter
- technology card: brand mark or monogram, name, type · domain, summary,
  popularity / maturity / learning curve / pricing badges, "Authorized use
  only" for offensive-security tooling, "AI fit" meter, Add to Library →
  "In Library" link
- technology detail: purpose, strengths and trade-offs, AI development fit
  (labelled Editor assessment: buildability, docs, community, token efficiency,
  adoption, training-data density, best models, frequent AI mistakes, verdict),
  speed estimate, facts (license, pricing, docs, repo, install), alternatives,
  pairs-with, presets using it
- stack detail: layers with marks, best for / not for, used by, AI friendliness,
  prototype speed vs production readiness with production gaps and hidden
  costs, operating profile, actions "Create stack profile" and "Add all to
  Library" with status messages linking to the Profile

## Appearance (report 39)

- theme select in the landing header, auth page, sidebar and mobile header;
  choice cards under Settings → Appearance (System / Light / Dark)
- the choice is a cookie so the first paint already has the right palette; no
  flash on navigation
- brand marks are tinted with the brand colour and fall back to the text colour
  when the brand colour would vanish on the current theme

## Discover (later)

Resource card:
- title
- short description
- category
- source
- compatibility
- why recommended
- Save
- Try in project
