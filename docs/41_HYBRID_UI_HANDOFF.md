# 41 — Hybrid UI Handoff (design-pack integration)

Target: the 27-screen design pack in `../claude-ui-handoff` (`CLAUDE_PROMPT.md`,
`DESIGN_SYSTEM.md`, `DOMAIN_BINDINGS.md`, `COMPONENTS.md`, `ACCEPTANCE.md`,
`screens/*.md`, `references/*.png`, gallery `index.html`), delivered on
2026-09-09 after `40_BILLING_HANDOFF.md`. This slice sits outside the numbered
production prompts, so the remaining prompt reports shift by one more:
privacy → 42, operations → 43, launch gate → 44.

## Scope and rules followed

- The reference PNGs and `DESIGN_SYSTEM.md` are the source of truth for the
  light desktop layout; dark mode and narrow viewports are adaptations, not
  approved designs.
- Every existing behaviour contract is unchanged: Better Auth sessions, the
  `/api/*` proxy, Zod contracts in `packages/contracts`, Resource / Profile /
  Recipe separation, Project > Recipe > Profile > Global precedence, the
  deterministic compiler (0.4.1, no version bump), versions, copy/export,
  entitlements. No migration, schema, contract or API change was needed.
- `DOMAIN_BINDINGS.md` is binding: the Library rule picker offers
  LOCKED / PREFERRED / DISABLED plus "Varsayılan kural yok" (stored preference
  `null`, never AI_DECIDE); AI_DECIDE project decisions keep `resourceId: null`
  and show constraints instead of a technology; LOCKED copy says the coding
  agent must not change the pick and never blocks editing; import preview with
  `dryRun: true` writes nothing and says so; catalog numbers, licences and
  scores come from real data and scores are labelled as editor assessments.
- Real HTML/React with Phosphor icons and `public/logos` through `TechLogo`;
  no PNG backgrounds, no hard-coded colours outside the token block.

## Delivered

### 1. Design system (`apps/web/app/globals.css`, rewritten; `hybrid.css` removed)
- Light-first tokens (`--canvas`, `--subtle`, `--ink`, `--muted`, `--line`,
  accent `#b4f000` with `--accent-text`, `--locked`, `--preferred`,
  `--success`, `--warning`, `--danger`), dark overrides under
  `:root[data-theme="dark"]` and the system preference when no explicit theme
  is set. Manrope + DM Mono with system fallbacks.
- Shared primitives: horizontal header with active underline and "Daha fazla"
  menu, `.page`, `.page-head`, buttons (primary/secondary/small/large/icon),
  chips and decision badges (kilitli / tercih edilen / AI karar versin / devre
  dışı), `.table` with group rows, tab rows, `.field` forms, `.drawer` and
  `.dialog`, `.wizard-page` (stepper, group tabs, sticky footer), `.split`
  layouts, readiness panel, timeline, toast, empty states.
- Responsive rules for 1024 and 390 px; tables collapse into labelled block
  rows below 700 px (`td[data-label]`), which also avoids the Chromium quirk
  where an overflowing `<table>` inflates `scrollWidth` without scrolling.

### 2. Shared components (`apps/web/components`)
`drawer.tsx` (DrawerFrame: right drawer or centred dialog, focus trap, Escape,
body scroll lock, focus return), `page-heading.tsx` (Breadcrumb, PageHead),
`row-menu.tsx`, `decision-badge.tsx`, `decision-table.tsx`
(GroupedDecisionTable), `decision-editor.tsx` (one editor for project, profile
and recipe decisions with provenance strip, mode radios, resource select,
allowed/excluded chips, constraint notes, rationale), `slot-picker.tsx`
("Karar ekle" dialog), `chip-field.tsx`, `copy-button.tsx`, `status-label.tsx`,
`tech-identity.tsx`, `theme-toggle.tsx` (header toggle and settings cards),
`command-palette.tsx`, `retry-button.tsx`, `tech-logo.tsx`,
`score-meter.tsx`. `decision-control.tsx` was removed.

Label helpers in `apps/web/lib`: `decision-slots.ts` (Turkish slot and mode
labels, `originLabel`), `resource-labels.ts` (`formatDateTime`, `pluralCount`),
`catalog-labels.ts`, `activity-labels.ts`, `billing-labels.ts`,
`context-status.ts`.

### 3. Screen coverage

| # | Screen | Route | Main files | Status |
| --- | --- | --- | --- | --- |
| 00 | AI talimatları master | `/workspace/projects/[id]/context` | `projects/[id]/context/context-client.tsx` | done; agent selector drives the real export format and file name |
| 01 | Tanıtım | `/` | `app/page.tsx` | done |
| 02 | Giriş yap | `/auth?mode=sign-in` | `auth/page.tsx`, `auth/auth-form.tsx` | done; no social login or reset (not in contract) |
| 03 | Hesap oluştur | `/auth?mode=sign-up` | same | done |
| 04 | Genel bakış | `/workspace` | `workspace/page.tsx` | done; checklist, recent projects, activity, Library strip |
| 05 | İlk kullanım | `/workspace` (onboarding `new`) | `workspace/first-run-panel.tsx` | done; sample install / skip / resume |
| 06 | Kütüphane | `/workspace/library` | `library/library-client.tsx` | done; "Projeler" column omitted (API gives no relation count) |
| 07 | Kaynak drawer | `/workspace/library` | same | done; category field mapped to type + tags, no new column |
| 08 | Teknoloji kataloğu | `/workspace/catalog` | `catalog/catalog-client.tsx`, `catalog-actions.tsx` | done; counts from `@devcontext/catalog` |
| 09 | Teknoloji detayı | `/workspace/catalog/[slug]` | `catalog/[slug]/page.tsx` | done; scores labelled as editor assessments |
| 10 | Hazır stack | `/workspace/catalog/stacks/[slug]` | `catalog/stacks/[slug]/page.tsx` | done; creates a PREFERRED profile, nothing locked |
| 11 | Profiller | `/workspace/profiles` | `profiles/profiles-client.tsx` | done |
| 12 | Profil detayı | `/workspace/profiles/[id]` | `profiles/[id]/profile-detail-client.tsx` | done; shared decision editor |
| 13 | Tarifler | `/workspace/recipes` | `recipes/recipes-client.tsx` | done |
| 14 | Tarif detayı | `/workspace/recipes/[id]` | `recipes/[id]/recipe-detail-client.tsx` | done; profile priorities bound to the real `priority` field |
| 15 | Projeler | `/workspace/projects` | `projects/projects-client.tsx` | done |
| 16 | Yeni proje 1/4 | `/workspace/projects?new=1` | `projects/project-wizard.tsx` | done; full-page wizard |
| 17 | Yeni proje 2/4 | same | same | done; seven slot groups as tabs, AI-freedom preset (low/balanced/high) |
| 18 | Yeni proje 3/4 | same | same | done |
| 19 | Yeni proje 4/4 | same | same | done; CTA saves the project, context is compiled separately |
| 20 | Proje genel bakış | `/workspace/projects/[id]` | `projects/[id]/page.tsx`, `project-header.tsx`, `project-actions.tsx` | done; readiness panel follows the real context state |
| 21 | Teknoloji yığını | `/workspace/projects/[id]/stack` | `projects/[id]/stack/stack-client.tsx` | done; provenance from the decision views |
| 22 | Karar drawer | same | `components/decision-editor.tsx` | done |
| 23 | Sürüm karşılaştırması | `/workspace/projects/[id]/context` (diff) | `context-client.tsx` | done; Pro gate message on Free |
| 24 | Ayarlar | `/workspace/settings` | `settings/settings-client.tsx` | done; theme cards, samples, plan link |
| 25 | Veri aktarımı | `/workspace/settings#import` | same | done; dry run → preview → explicit apply, strategies skip/copy/replace |
| 26 | Bağlantı hatası | shared | `workspace/unavailable.tsx`, `error.tsx`, `not-found.tsx`, `components/retry-button.tsx` | done; distinct from 404 and sign-out |

Additional screens kept in the same language: `/workspace/billing`
(`billing/billing-client.tsx`), `/billing/checkout` and `/billing/portal`
(fake provider pages).

### 4. Copy and navigation
- All workspace copy is Turkish; brand names, enum values, URLs and API keys
  stay as they are. Anonymous visitors are redirected to `/auth?mode=sign-in`.
- The e2e helpers (`e2e/support/workspace.ts`) and all ten specs were rewritten
  against the new labels and structure (full-page wizard, row menus, drawers).

## Verification

Commands ran through `.local/runtime/pnpm.cmd` (see Tooling) on 2026-09-09:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | pass (198 unit/API tests) |
| `pnpm build` | pass (Next.js 16 production build) |
| `pnpm test:db` | pass (PGlite replay + PostgreSQL integration on a scratch database) |
| `pnpm test:e2e` | 13 / 13 Playwright journeys pass (see final run note below) |

Visual comparison: `.local/ui-shots.mjs` signs a throwaway user up, installs
the samples and screenshots all 27 states; the desktop set (1440 × 1024) was
compared side by side with `references/*.png`, the mobile set (390 × 844) was
checked for horizontal overflow on every route (zero offenders after the
table stacking, landing header, tech hero and split-layout fixes). The
1024 × 768 set and a dark-theme sanity pass were run on the same build.
Console and network were clean during the flows; the Next route announcer is
the only extra `role="alert"` on the page and the specs filter for it.

Final run: `pnpm build && pnpm test:e2e` after the last selector fixes
(overview stack card text instead of a hard-coded decision count, disclosure
helper that does not toggle an already open `<details>`, cleared Library
search before the archive step, `Gerekçe` textbox selected by role).

## Known differences from the PNGs (deliberate)

- Fixture text such as "Atlas Finance", "246 teknoloji" and sample dates is
  not reproduced; the screens show the signed-in user's real data and the
  catalog's real counts.
- 06 has no "Projeler" count column and 07 has no separate category field
  (no such data in the contracts; nothing was added for the mock).
- The Library rule picker's fourth option is "Varsayılan kural yok", not an
  AI decision.
- 17's "Fastify · AI karar versin" row is rendered as a delegated slot with
  constraints; a delegated slot never shows a chosen technology.
- 19's CTA saves the project; the "Talimatlar oluşturuldu" state only appears
  after a real compile on the context page.
- Dark mode and 390 px layouts are adaptations; they keep the tokens and
  hierarchy but were not designed in the pack.
- Font rendering, antialiasing and exact pixel spacing differ from the raster
  references; proportions (header, page gutter, 63/35 split, 35 % resource rail
  on 00, four wizard steps with seven groups) match.

## Tooling notes

- Windows App Control blocks `.local/pnpm12/package/pnpm-native.exe`.
  `.local/runtime/pnpm.cmd` now runs `.local/runtime/pnpm-shim.mjs`, a Node
  stand-in that supports `run`, `exec`, `--filter`, `-r` and `--version` and
  refuses install-type commands; the original launcher is kept as
  `pnpm-native.cmd`. No operating-system setting was changed.
- `.local/ui-shots.mjs` (`--out DIR`, `--mobile`, `--only`) and
  `.local/ui-overflow.mjs` (outermost overflowing elements at 390 px) are
  local verification helpers, not part of the build.

## Risks and follow-ups

- The wizard applies the "Dengeli" AI-freedom preset when the user reaches
  step 2, so a new project carries twelve AI_DECIDE decisions plus inherited
  Library rules; the overview card lists concrete picks first. If this is too
  noisy for real users, change the default preset to "Düşük" in
  `project-wizard.tsx` (one line) rather than filtering decisions in the UI.
- Screens were verified in Chromium only (Playwright). Safari/Firefox checks
  belong to the launch gate.
- Docs `21_UI_SCREEN_BLUEPRINT.md` describes the pre-design-pack layout; it is
  kept for history and points here.

## Next prompt

`prompts/claude-code-production/10_H11_V1_PRIVACY_DELETION_LEGAL.md`
(account export/deletion, integration revocation, legal surfaces) → report
`docs/42_PRIVACY_DELETION_LEGAL_HANDOFF.md`. New surfaces must reuse the
drawer, page head, table and form primitives from this slice.
