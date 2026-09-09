# 14 — Testing Strategy

## Testing pyramid

### Unit
Best for:
- decision precedence
- slot resolution
- compatibility rules
- export formatting
- slug/name helpers

### API integration
Use Fastify `inject`.

Test:
- auth boundaries
- ownership
- resource CRUD
- project create/update
- decisions
- compile endpoint
- validation errors

### Database integration
Run against real PostgreSQL in CI where practical.

### E2E
Playwright:
1. sign in
2. add resource
3. mark preferred
4. create project
5. set AI Decide
6. generate context
7. preview export

## Golden compiler tests

Compiler output is core business behavior.

Store fixtures:
`examples/generated-context/`

A compiler semantic change should intentionally update fixtures.

## Security regression tests

- user A cannot access user B resource/project
- invalid URL schemes rejected
- oversized metadata rejected
- disabled resources remain in negative instructions, not active stack
