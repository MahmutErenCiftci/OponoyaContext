# 29 — Resource Library Handoff

Target: V0.1 Library Alpha / Handoff 3.

## Delivered

- authenticated Resource create, read, edit, list and soft-archive API
- archive view and recoverable restore flow
- owner-scoped queries for every read and mutation
- name/description/notes search plus type, tag and preference filters
- normalized, user-scoped tags with transactional Resource attachment
- optional global `LOCKED`, `PREFERRED` or `DISABLED` preference per decision slot
- preference removal when a Resource is archived so archived entries cannot be newly selected
- duplicate source URL warning without blocking the save
- HTTP/HTTPS-only URL validation and bounded metadata
- protected, responsive `/workspace/library` UI with an add/edit drawer
- live Library count on the workspace overview

## API

- `GET /v1/resources`
- `POST /v1/resources`
- `GET /v1/resources/:id`
- `PATCH /v1/resources/:id`
- `DELETE /v1/resources/:id`
- `POST /v1/resources/:id/restore`

All ownership is resolved from `request.currentUser.id`. Caller-provided owner
headers and IDs are ignored.

## Data/config changes

No new migration was required. Handoff 1 already established `resources`,
`tags`, `resource_tags` and `global_decisions` with the required foreign keys,
unique constraints and indexes.

## Verification

- TypeScript strict typecheck
- lint
- unit and contract tests
- API route and ownership tests
- production build
- PostgreSQL migration replay test
- Playwright desktop/mobile Library journey including add, search, edit,
  disable, archive and restore

## Next logical handoff

Handoff 4 — Minimal Projects: authenticated Project CRUD, wizard persistence and
manual Resource attachment.
