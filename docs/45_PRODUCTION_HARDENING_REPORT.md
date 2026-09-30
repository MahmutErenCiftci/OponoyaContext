# 45 — Production Hardening, Performance and AI Groundwork

Date: 2026-09-26. Branch: `dev`, uncommitted working tree (nothing was
committed or pushed). Scope requested by the owner: finish the product to a
production-grade state, test everything, clean up and optimise the code, lay
the groundwork for AI, run a serious security review, and check that logos,
icons and names work.

## Status

The code-level work is complete and verified locally (evidence below). The
launch gate in `44_V1_LAUNCH_GATE.md` stays **BLOCKED** on the same owner-only
items (hosting, managed PostgreSQL, DNS/TLS, monitoring, repository
publication/CI run, legal identity and approval). This report does **not**
declare the product production-ready.

## Verification evidence

Local gate on this workspace (`.local/runtime/gate.sh`, production build):

| Step | Result |
| --- | --- |
| typecheck (root + 6 packages) | pass |
| lint (scripts, e2e, 6 packages) | pass |
| unit/integration tests | contracts 6, catalog 5, compiler 21, db 11, API 219, web 29 — all pass (291) |
| build | pass |
| bundle guard (`scripts/verify-bundle.mjs`) | clean (now also checks `WEB_PROXY_SECRET`, the proxy header and `AI_API_KEY`) |
| `test:db` (PostgreSQL 18.6 drills) | pass |
| e2e (Playwright, production build, real PostgreSQL) | 15/15 pass, including the new `e2e/ai.spec.ts` and `e2e/password-reset.spec.ts` |

Before this pass the suites were: API 156, compiler 16, db 8, e2e 13.
The `pg` "client is already executing a query" deprecation warning seen in
earlier e2e logs no longer appears.

Additional checks run by hand:
- Restore drill on a scratch database: passes; refuses the source under
  another spelling and a non-empty target (see Infrastructure).
- `scripts/sync-main.mjs` in a throwaway clone: a published commit has only
  the previous `main` as parent; `dev` is no longer reachable from `main`;
  `--fresh` produces a single root commit without dev-only paths.
- ReDoS inputs against the redactor: ≤ 2.1 ms per call (was seconds).
- Client JavaScript per route (first load, uncompressed): public pages
  900 → 503 KB (`/`), 899 → 502 KB (`/auth`), 886 → 488 KB (`/legal/*`);
  workspace pages −252 to −266 KB each (e.g. context page 1,148 → 882 KB).

## Security

A full review found 2 High, 4 Medium, 7 Low and 8 Info items. All High and
Medium items are fixed and tested; details in `12_SECURITY_PRIVACY.md`.

| Finding | Fix | Evidence |
| --- | --- | --- |
| H — ReDoS in error redaction (request data reached a cubic regex through query-error messages) | truncate first, bounded keyword-anchored patterns, summarise the query error's cause | `apps/api/test/redact.test.ts` |
| H — import validation could allocate > 1 GB | structural bounds before the walk, one import per user | `portability.test.ts`, `portability.routes.test.ts` |
| M — password-free deletion via Better Auth `delete-user` | proxy allow-list (sign-in/up/out only) + `disabledPaths` | `security.routes.test.ts` |
| M — spoofable / global rate-limit identity | `TRUST_PROXY` private ranges or CIDR list; `WEB_PROXY_SECRET` assertion from the web proxy; Better Auth reads the verified address | `security.routes.test.ts`, `apps/web/test/proxy.test.ts`, `config.test.ts` |
| M — body parsing before authentication | `onRequest` authentication on every route, 30 s request timeout, web proxy body caps and timeouts | route tests |
| M — unbounded data driving compiles | expensive rate-limit bucket for compile/context/diff/versions/bundle/exports/account export; 80 decisions per entity, 500 compatibility rules | `limits.repository.test.ts`, `rate-limit.test.ts` |
| L — export structure injection into AGENTS.md/CLAUDE.md/Cursor | compiler 0.4.2 (below) | `export-hardening.test.ts` |
| L — malformed URL / NUL / int4 overflow → 500 | `URL.parse`, invalid-input SQLSTATEs → 400, int4 bounds on version params | `app.test.ts` (22021/22P05/22003 → 400), `resources.service.test.ts` |
| L — production guards keyed on `NODE_ENV` only | `APP_ENV ?? NODE_ENV`, placeholder secrets refused, DB TLS required, HTTPS reporting endpoints | `config.test.ts` |
| L — state-changing GETs reachable cross-site | Fetch-Metadata check (403) on bundle and export downloads | `security.routes.test.ts` |
| L/I — LIKE wildcards, text/plain parser, Better Auth console logs, absolute-form auth URLs, fake billing state growth | `containsPattern()`, parser removed, redacting log sink, path-only URL, bounded session map | `read-all.test.ts`, route tests |
| I — backups contain hashes and tokens | owner-only file modes (`0600`/`0700`), documented | `13_DEPLOYMENT.md` |

Web: per-request nonce Content-Security-Policy (`apps/web/proxy.ts`), security
headers in `next.config.ts`, one hardened `/api/*` proxy (`lib/proxy.ts`) with
request/response header allow-lists, path re-encoding and dot-segment refusal.

Accepted/open (owner decisions): password reset works only once an e-mail
provider is configured, and e-mail verification is not built; plan-limit checks can race with parallel creates (small
overage); an Idempotency-Key equal to a foreign UUID reveals that the id
exists (impractical with random ids).

## Bugs found and fixed during testing

- Account summary counts used Drizzle column interpolation inside correlated
  subqueries; PostgreSQL rejects the rendered SQL as ambiguous (`42702`), so
  `GET /v1/account` (Settings › Gizlilik) would have failed on a real
  database. Rewritten with aliased identifiers and covered by
  `account.service.test.ts` on real SQL.
- AI suggestion timestamps came from the database clock while the quota window
  used the service clock; both now use the service clock.
- The error reporter could skip its first transport warning when the clock
  started at 0.
- Concurrent queries on one transaction connection (sample install, imports):
  repositories now use `readAll()`, which is sequential inside transactions.
- The e2e reliability spec expected the API's English message; the UI now
  shows Turkish copy for envelope codes.

## Performance and cost

- `GET /v1/projects/context-status` batches freshness for lists and the
  overview instead of compiling and rendering every project per view.
- Migration 0009 adds the missing foreign-key and lookup indexes (export
  events, profile attachments, tags, decision `resource_id`), which also keeps
  account deletion cascades fast; the migrator runs with a 10-minute timeout.
- Versions list fetches only the plan's history; exports render one target.
- Account counts in one statement; React `cache()` per request; parallel data
  loading on detail pages.
- Duplicate detection only reads candidates of the same type or with a URL.
- Catalog stack adds: one link lookup and one transaction (all-or-nothing,
  serialised per owner) instead of N+1 non-transactional calls.
- Bundle: product identity moved to `@devcontext/contracts/brand` (no Zod), and
  Zod is imported as a namespace so unused locales drop out (numbers above).
- Fonts are self-hosted through `next/font` (no Google requests, tighter CSP).

## Context compiler 0.4.2

User, imported and AI text can no longer add headings, list items, fences,
HTML blocks or front-matter keys to exports; ordinary text renders
byte-identically. The header says "generated by DevContext". Goldens and
`examples/generated-context` were regenerated (only version, header and hash
changed). Stored versions show as stale once and recompile to 0.4.2.

## AI groundwork (off by default)

See `11_AI_DECISION_ENGINE.md` and `17_API_CONTRACTS.md`. One capability —
proposing a Library Resource for a delegated slot — with an official-SDK
Anthropic adapter (`claude-opus-5` default, structured outputs, refusal
fallbacks) and a deterministic fake provider; explicit consent, a monthly
quota per plan, a prompt-injection data boundary, validation of every answer,
pending → accept/reject review, and privacy surfaces (legal config, account
summary/export, deletion). Web: consent switch in Settings › Gizlilik, a
suggestion panel in the decision editor for `AI_DECIDE` slots.

## Other product changes

- Password change in Settings (current password verified, every other session
  signed out, this session renewed).
- Password reset ("Şifremi unuttum", `/auth/forgot`, `/auth/reset`) through
  Better Auth behind a provider-neutral e-mail sender: enumeration-safe
  request, one-hour single-use token, every session ends on reset, routes
  unreachable and the link hidden while no sender is configured. Only the
  development `log` sender exists (refused in production); covered by
  `password-reset.test.ts` (real Better Auth on PGlite), `auth.routes.test.ts`
  and `e2e/password-reset.spec.ts`.
- Library and Projects lists: "Daha fazla göster" pagination; the count no
  longer claims to show rows that were not loaded. Profiles and Recipes load
  the API's full page (100, the Pro limit).
- "Tarif olarak kaydet" in the project menu (the API route existed without a
  UI); covered in `e2e/usability.spec.ts`.
- Dates and times are shown in Türkiye time (`Europe/Istanbul`, fixed on
  server and client) instead of unlabelled UTC.
- Settings notices distinguish failures (red, `role="alert"`) from
  confirmations; plan refusals no longer promise an upgrade the free beta
  cannot offer; every API detail code the UI can meet has Turkish copy;
  compiler warnings get a Turkish headline next to the code; the Plan page
  shows the subscription status in Turkish; downloads of nested targets tell
  the user the repository path (`.cursor/rules/…`, `.github/…`), because
  browsers drop folders from download names; the auth page no longer promises
  team features or version rollback.
- Activity feed labels and links for the account and AI actions.
- Turkish copy for API error codes (`lib/errors.ts`), plan refusals naming the
  refused feature or limit, and several copy fixes ("Servis / API", informal
  forms, `Kodlama ajanı`, Turkish export labels).
- Brand: one set of product identity constants; generated favicon, Apple icon,
  Open Graph image and web manifest with the Manrope brand font; page titles
  on every page; `lang="tr"` everywhere.
- Logos: wrong-brand marks removed (Auth.js ≠ Next.js, Iceberg, Framer Motion,
  Power BI, CodeQL), theme-aware colours with a contrast fallback, letter
  monograms without punctuation, 45 decorative icons marked `aria-hidden`.
- Catalog names follow the catalog's own rule (no version numbers: Vue.js,
  Svelte, Bootstrap, JavaScript, PHP, Remix / React Router) and brand spelling
  (IdeaSoft, n11); the logo index also answers to short names ("Vue", "Node",
  "Next"). The manifest was rebuilt with `scripts/fetch-logos.mjs --offline`.

## Infrastructure and release hygiene

- `scripts/sync-main.mjs`: `main` no longer has `dev` as a parent (the old
  behaviour made every internal document reachable from `main`); `--fresh`
  restarts `main`. **The existing `main` history still links `dev`**: run
  `node scripts/sync-main.mjs --fresh` and force-push before the repository is
  shared.
- `.gitignore` covers every `.env.*` except `.env.example`.
- Env templates document `WEB_PROXY_SECRET`, `TRUST_PROXY` semantics, the AI
  variables and `sslmode=verify-full`; the staging compose passes only
  `API_URL` and `WEB_PROXY_SECRET` to the web container.
- `scripts/restore-drill.mjs` refuses the source under another address and a
  target that already holds accounts (`--wipe-nonempty-target` to override).
- The web logs `web_proxy_secret_missing` once when running in production
  without the secret.

## Owner decisions still needed

1. Launch blockers from report 44 (hosting, managed PostgreSQL, DNS/TLS,
   monitoring destination, repository publication/CI, legal values and
   approval).
2. Free beta scope: with `BILLING_PROVIDER=none` everyone is on Free, so the
   Cursor/Copilot exports, the zipped bundle and the version diff are not
   available at launch (the roadmap promises them for V1). Keep, or grant them
   during the beta.
3. Product name: the UI, exports and icons say "DevContext" (one constant);
   confirm it against "Oponoya Context" before launch.
4. AI activation: provider key, model/effort, quotas (5/100 are placeholders),
   Privacy text and subprocessor list.
5. Free beta limits (3 projects, 50 resources, 2 profiles, 1 recipe) versus a
   246-technology catalog and stack presets.
6. Pro limits exceed portable import bounds (see `16_PRICING_MONETIZATION.md`).
7. E-mail provider (sender domain, SPF/DKIM): password reset is built and
   switches on with it; e-mail verification is still to do.
8. Republish `main` with `--fresh` before sharing the repository.
9. Optional CI hardening: pin actions by commit SHA, add Dependabot.
10. Product follow-ups from the research in `46_PRODUCT_GAP_RESEARCH.md`
    (AGENTS.md-first exports, managed blocks, a CLI/GitHub Action/MCP delivery
    path, onboarding with the catalog, Turkish sample data).
