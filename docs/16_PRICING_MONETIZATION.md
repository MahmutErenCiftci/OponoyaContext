# 16 — Pricing Strategy

## Launch principle

Charge for sustained organization/context value, not raw "number of prompts."

## Suggested V1 structure

### Free
Enough to experience value:
- limited projects
- limited saved resources
- basic compiler/export

### Pro
Primary individual plan:
- unlimited/large limits
- profiles/recipes
- context versions/diff
- all export adapters
- advanced Library

### AI usage
When AI enrichment/recommendation launches:
- quota/credits
- never promise unlimited expensive inference
- deterministic compiler does not need per-use AI billing

### Team (V2)
Per-seat:
- shared resources
- company profiles
- enforced rules
- audit history

## Implemented limits (Handoff 10, report 40)

The API is the single source of plans (`apps/api/src/modules/billing/plans.ts`);
the web renders what `GET /v1/billing` reports.

| Feature | Free | Pro |
| --- | --- | --- |
| Active projects | 3 | 500 |
| Active Library resources | 50 | 5000 |
| Profiles | 2 | 100 |
| Recipes | 1 | 100 |
| Exports | master prompt, `AGENTS.md`, `CLAUDE.md` | + Cursor `.mdc`, Copilot |
| Zipped context bundle | — | included |
| Version history shown | last 3 | last 50 |
| Version diff | — | included |
| Import / export own data | included | included |
| Price | free | set by the operator via `BILLING_PRO_PRICE_LABEL`; not announced yet |

Rules: archived items never count; nothing is deleted when a plan ends, the user
only stops creating above the Free limits; cancellation keeps Pro until the paid
period ends; a failed renewal keeps Pro for 7 days with a visible warning; a
late renewal event keeps Pro for 3 days. No AI credits are sold and no copy
promises unlimited inference. Team plans stay V2.

## Lifetime deal

Only consider for launch marketing with explicit exclusions:
- core product access
- not unlimited future AI inference
- not future enterprise/team seats

## Pricing validation

Do not optimize pricing before observing:
- weekly active users
- projects per user
- export frequency
- retention after second project
- willingness to move real development rules into product
