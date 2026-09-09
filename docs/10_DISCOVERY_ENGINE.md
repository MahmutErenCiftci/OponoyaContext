# 10 — Discovery Engine (V1.2+)

## Why not in MVP

Discovery is attractive but can consume the entire product roadmap.

The core business must first prove:
Library → Project → Context.

## V1.2 strategy

Start as a curated catalog, not a web-scale crawler.

Catalog fields:
- canonical name
- category
- official site
- repository
- description
- tags
- compatibility
- install method
- license
- last reviewed
- popularity signals
- freshness signals

## User actions

- Save to Library
- Add to Project
- Compare
- Ignore
- Not relevant

## Ranking

Start simple:
- category relevance
- compatibility with user's saved resources
- freshness
- popularity
- explicit user tags/interests

Avoid opaque "AI score" at first.

## Personalization signal

Strong:
- resources user marked preferred
- frameworks in active projects
- resources repeatedly used
- explicit ignored categories

Weak:
- one-off clicks

## Moderation

Any community submission must be reviewed before becoming globally discoverable.

## Safety

Resource pages can contain malicious install instructions.

Never:
- automatically execute install commands
- run copied scripts server-side
- treat README commands as trusted

Display source and provenance clearly.
