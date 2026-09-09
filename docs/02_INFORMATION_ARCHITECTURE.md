# 02 — Information Architecture

## Global navigation

### Dashboard
- recent projects
- recently saved resources
- recommendations
- context generation shortcuts
- incomplete setup tasks

### Library
Filters:
- type
- tags
- source
- ownership
- status
- compatibility
- favorite
- used in projects

Views:
- all
- favorites
- components
- prompts
- repositories
- AI tools
- archived

### Discover
V1.2+:
- For You
- Trending
- New
- Frontend
- Backend
- UI
- Animation
- AI Tools
- MCP
- Templates
- Starter Kits
- Database
- DevOps

### Catalog
- technologies (246 in 9 domains, read-only research)
- stack presets (15) with separate prototype / production scores
- add to Library, create stack Profile from a preset

### Profiles
- Stack Presets
- Design Profiles
- AI Profiles
- Deployment Profiles
- Recipes

### Projects
- project list
- create project
- archived projects

### Settings
- account
- defaults
- export preferences
- connected integrations
- API keys (later)
- billing
- privacy

## Project navigation

`/projects/:projectId`

- `/overview`
- `/stack`
- `/components`
- `/design`
- `/resources`
- `/rules`
- `/architecture`
- `/context`
- `/exports`
- `/history`

## Library resource detail

- Overview
- Usage Rules
- Compatibility
- Projects Using It
- Install / Reference
- Notes
- Versions
- History

## Key UI component: DecisionControl

Every decision slot should use the same mental model:

```text
Backend Framework

Mode:
[ Locked | Preferred | AI Decide | Disabled ]

Resource:
[ Fastify ]

Constraints:
[ Fast MVP, low complexity ]

Why:
[ Optional note ]
```

Consistency here is more valuable than clever UI.
