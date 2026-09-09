# 39 — Technology Catalog, Brand Logos and Light Theme Handoff

Target: out-of-sequence product request after Handoff 9 (`38_V1_PORTABILITY_HANDOFF.md`),
delivered on 2026-09-08. Handoff 10 (billing and entitlements) remains the next
numbered prompt; this slice does not change its scope.

The request had three parts: (1) a light theme for the whole site, (2) bring the
technology / tech-stack research another agent produced (`data/catalog/`,
`docs/37_TECHNOLOGY_CATALOG_RESEARCH.md`) into the product, and (3) download the
real logos of those technologies.

## Delivered

### 1. `@devcontext/catalog` package (read-only reference data)
- `packages/catalog` embeds `data/catalog/*.json` at build time
  (`scripts/generate.mjs` → `src/generated/data.ts`, ignored by git and lint) and
  validates every file with Zod at module load: 246 technologies in 9 domains,
  15 stack presets, 50 AI-readiness and 28 velocity assessments. A malformed data
  file fails the build and the tests, never a request. `data/catalog/**` is a
  turbo global dependency so edits invalidate caches.
- Public API: `getOverview()`, `listTechnologies({ domain, type, q, tag })`
  (diacritic-insensitive search, curated order), `getTechnology(slug)` with
  resolved `alternatives`/`pairsWith` references (`known: false` for the 386
  slugs not in the catalog yet), readiness, velocity and the presets that use
  it; `listStacks()`, `getStack(slug)` with layers resolved in layer order;
  `technologiesForStack`, `unknownStackReferences`, `pendingReferences()` and
  `presetDecisionsForStack(slug)` (one technology per decision slot; languages
  fill both language slots; styling/state/CI entries have no slot).
- Contracts (`packages/contracts`): `catalog*Schema` DTOs. Readiness scores that
  do not apply to AI tools themselves (`aiBuildability`, `tokenEfficiency`,
  `trainingDataDensity`, `bestModels`) are nullable, as in the research data.

### 2. API (`apps/api/src/modules/catalog`)
- Authenticated reads: `GET /v1/catalog` (counts, domains with notes, the
  methodology disclaimer), `GET /v1/catalog/technologies` (`domain`, `type`, `q`,
  `tag`, `limit` ≤ 500, `offset`), `GET /v1/catalog/technologies/:slug`,
  `GET /v1/catalog/stacks`, `GET /v1/catalog/stacks/:slug`,
  `GET /v1/catalog/library` (catalog slug → active Resource id).
- Library bridge: `POST /v1/catalog/technologies/:slug/library` creates an
  ordinary Resource (`metadata.catalogSlug`, docs/repo/install fields, tags,
  research notes in their original language, license/pricing/popularity
  metadata). Idempotent per owner: an active copy is returned (200), an archived
  copy is restored, otherwise 201. `POST /v1/catalog/stacks/:slug/library` adds
  every known technology of a preset (`created`, `existing`, `skipped` for slugs
  the catalog does not describe). `POST /v1/catalog/stacks/:slug/profile` does the
  same and creates one stack Profile with a PREFERRED decision per preset slot;
  an active stack Profile with the preset's name is returned unchanged
  (`created: false`). Unknown slugs answer 404 with a public message; malformed
  slugs 400. The two stack mutations are rate-limited as expensive routes.
- Resource repository gained `listCatalogLinks(ownerUserId)` (JSONB
  `metadata->>'catalogSlug'`), owner-scoped like every other query.
- Audit: `catalog.technology_added` (resource), `catalog.stack_added`
  (workspace, counts) and `catalog.stack_profile_created` (profile); metadata
  carries slugs, booleans and counts only.

### 3. Web
- New `Catalog` section in the workspace navigation and command palette:
  `/workspace/catalog` (stack preset strip with separate prototype-speed /
  production-readiness meters, domain chips with the security and Türkiye
  notes, search, type filter, technology cards with logo, badges, "AI fit"
  meter, "Add to Library" → "In Library" link), `/workspace/catalog/[slug]`
  (purpose, strengths/trade-offs, AI development fit labelled *Editor
  assessment*, speed estimate, facts, alternatives, pairs-with, presets) and
  `/workspace/catalog/stacks/[slug]` (layers with logos, fit, operating profile,
  velocity with production gaps, "Create stack profile" / "Add all to Library").
  Offensive-security tooling keeps the research tag as an "Authorized use only"
  badge. Scores are never called benchmarks in the UI.
- Library rows show the brand mark for catalog-linked resources (by
  `metadata.catalogSlug`, a distinctive documentation host, or an exact name
  match that ignores the "Sample ·" prefix); everything else keeps a monogram.
  The landing page's tool strip uses the same marks.
- Light theme: `globals.css` now uses design tokens (dark default, light
  palette under `:root[data-theme="light"]` and the system preference via
  `prefers-color-scheme`). The choice lives in the `devcontext-theme` cookie
  (one year, `SameSite=Lax`) so the root layout renders the right palette on the
  first paint; `ThemeToggle` (compact select in the landing header, auth page,
  sidebar and mobile header; choice cards under Settings → Appearance) writes
  the cookie and applies the attribute without a reload. Brand colours that
  would vanish on a theme fall back to the text colour.

### 4. Logos (`apps/web/public/logos`)
- `scripts/fetch-logos.mjs` downloads Simple Icons 16.30.0 (CC0-1.0) SVGs from
  jsDelivr for each catalog slug (explicit overrides plus automatic slug
  guesses), keeps the icon slug and brand hex inside each file, and writes
  `apps/web/lib/logo-manifest.json` (logos, normalised names, distinctive
  hosts). `--offline` rebuilds the manifest from downloaded files.
- Result: 194 of 246 entries have a brand mark; the 52 without one (Turkish
  services, practices such as OWASP Top 10 or rate limiting, and brands Simple
  Icons does not carry such as AWS, Twilio, Playwright) are listed in
  `apps/web/public/logos/README.md` and render as monograms. Logos are
  trademarks of their owners and are used only to identify the technology.

## Verification (Node 26.8.1 / pnpm 12.3.4 / PostgreSQL 18.6)

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass (root `tsc --noEmit` + 9 workspace tasks) |
| `pnpm lint` | pass (root eslint + 9 workspace tasks) |
| `pnpm test` | pass — compiler 16, contracts 6, catalog 5, db 7, web 16, api 133 |
| `pnpm build` | pass (6 tasks) |
| `pnpm test:db` | pass — db 3, api 5 on a scratch PostgreSQL database |
| `pnpm test:e2e` | pass — 12 journeys (Chromium, dark colour scheme by default, scratch database, 31.2s) |

Coverage added: `packages/catalog/test/catalog.test.ts` (file validation,
counts, unique slugs, reference resolution, folded search, stack layers,
separate velocity scores, preset slot mapping), `apps/api/test/catalog.routes.test.ts`
(auth, filters, 404/400, idempotent add, content-free audit, stack add with
skipped slugs, preset Profile once), `apps/api/test/catalog.service.test.ts`
(PGlite: bounded Resource input, restore of archived copies, owner isolation,
Profile decisions), `apps/web/test/theme.test.ts`, `apps/web/test/logos.test.ts`
and `e2e/catalog.spec.ts` (browse, add with logo, detail, preset → Profile,
idempotent replay, Library marks, light theme persisted across reload and the
landing page, mobile overflow; screenshots `catalog-dark-desktop.png`,
`catalog-light-desktop.png`, `landing-light-desktop.png`, `catalog-mobile.png`).

## Known risks and notes

- Adding the same technology twice in parallel can create two Resources (no
  unique constraint on `metadata.catalogSlug`); the UI disables the button while
  pending and later calls return the first active copy.
- "Create stack profile" matches an existing Profile by exact name and type
  only; renaming the Profile and clicking again creates a second one.
- Catalog text is the research's Turkish; UI labels are English. Notes copied
  into the Library keep Turkish section headings so the two stay consistent.
- The `Java` mark uses the OpenJDK icon and `Codex` has no icon (Simple Icons
  removed several brand marks for trademark reasons).
- Remaining research recommendations not implemented: automatic "avoid" rules
  from `aiPitfalls` in compiled context, stack-specific launch checklists from
  `productionGaps`, Turkish bureaucratic-timeline warnings, live npm/GitHub
  metrics. They are listed under P2 in `docs/18_BACKLOG.md`.

Next prompt: prompts/claude-code-production/09_H10_V1_BILLING_ENTITLEMENTS.md
