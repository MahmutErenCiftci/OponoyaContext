# 28 — Authentication Handoff

Target: V0.1 Authentication / Handoff 2.

## Delivered

- Better Auth email/password signup, login and logout under `/api/auth/*`
- Drizzle-backed users, sessions, accounts and verifications
- secure HTTP-only session cookie with explicit trusted origin and API base URL
- production-only explicit secret requirement and auth endpoint rate limits
- Fastify `authenticate` pre-handler and session-derived `request.currentUser`
- authenticated `GET /v1/me` contract
- public product landing, signup/login screen and protected `/workspace` shell
- ownership test proving caller-supplied owner headers are ignored
- Playwright journey covering signup, protected workspace, logout and login

## Data/config changes

- Migration `0001_amazing_supernaut.sql` adds auth tables and Better Auth user fields.
- `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` are documented in `.env.example`.
- Existing users with no name receive a safe display-name fallback in migration.

## Verification

- typecheck
- lint
- unit tests
- production build
- PostgreSQL integration test
- Playwright authentication journey

## Next logical handoff

Handoff 3 — Resource Library: authenticated Resource CRUD, tags and global
preferences with every query scoped to `request.currentUser.id`.
