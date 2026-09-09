# 22 — Domain Rules

## Resources
- Archived resource cannot be newly selected but existing project references remain visible.
- Deleting a resource must not erase context history.
- Duplicate URLs should warn, not hard-block.

## Decisions
- `AI_DECIDE` does not require `resource_id`.
- `LOCKED`, `PREFERRED`, `DISABLED` normally require a resource when representing a technology.
- A slot can have at most one effective decision at each exact scope.
- Project decision shadows inherited decision; it does not delete it.

## Profiles
- A profile contains reusable decisions.
- Project may attach multiple profiles, but same-slot conflicts must have deterministic priority and visible provenance.

## Recipes
- Recipe is a composition shortcut, not an immutable project template.
- Applying recipe creates inheritance/reference, not a disconnected copied blob, unless user explicitly chooses clone/freeze behavior in a later version.
- Implemented (Handoff 9): `projects.recipe_id`; precedence Project > Recipe > Profile > Global; the Recipe's Profiles contribute to the Profile scope with the Recipe's priorities; archived Recipes keep contributing to Projects that already apply them.

## Portability
- Export never contains account, session, provider or history rows.
- Import validates the whole document first, previews by default and mutates only after an explicit confirmation with a chosen duplicate strategy; nothing in a file is executed or fetched.

## Compiler
- No network access required.
- No AI required.
- Same canonical inputs + compiler version => same output.
- Export adapter does not alter canonical semantics.

## Compatibility
- Warning != automatic replacement.
- Hard conflict should be clearly visible.
- User can intentionally proceed with warning.

## Version history
- Store only when canonical hash changes.
- History remains readable even if source resource is later archived.
