# 09 — Context Compiler Specification

The Context Compiler is the product's core engine. Implementation:
`packages/context-compiler` (pure, no I/O). Current `COMPILER_VERSION`: `0.4.1`.

## Goal

Convert scattered structured decisions into one deterministic, explainable project context.

## Inputs

```ts
type CompileInput = {
  project: ProjectInput;              // id, name, slug, description, productType, stage, platforms, priorities
  resources: ResourceInput[];         // every Resource referenced by decisions or attached, incl. archived ones
  attachedResourceIds?: string[];     // reference-only Project attachments
  globalDecisions?: DecisionInput[];
  profileDecisions?: DecisionInput[]; // from attached Profiles, with sourceId/sourceName/sourcePriority
  recipeDecisions?: DecisionInput[];  // the Project's applied Recipe (Handoff 9), with sourceId/sourceName
  projectDecisions?: DecisionInput[];
  compatibilityRules?: CompatibilityRuleInput[]; // owner-curated conflicts/requires pairs
};
```

A `DecisionInput` carries `id`, `scope`, `slot`, `mode`, optional `resourceId`,
`priority`, `constraints`, `rationale`, `updatedAt` (tie-breaker only) and, for
Profile/Recipe decisions, `sourceId`, `sourceName` and `sourcePriority` (the
attachment priority on the Project). `ProjectInput.rules` carries explicit
engineering rules.

## Decision modes

### LOCKED
Exporter language:
> Use X. Do not replace it without explicit project-owner approval.

### PREFERRED
Exporter language:
> Prefer X. Use an alternative only when it cannot satisfy the requirement, and document why.

### AI_DECIDE
Exporter language:
> This decision is delegated to you. Choose the smallest appropriate solution within the stated constraints and document the choice.

`AI_DECIDE` never names a Resource.

### DISABLED
Exporter language:
> Do not use X in this project.

Disabled Resources are rendered under "Do not use" and are excluded from the
active resource list even when attached to the Project.

## Precedence

For the same slot:

1. Project explicit decision
2. Recipe decision
3. Profile decision
4. Global decision

Highest-precedence scope wins.

Within a scope:
- `sourcePriority` (the Profile/Recipe attachment priority on the Project)
- explicit decision `priority` (higher wins)
- newest `updatedAt`
- id (ascending) as the final deterministic tie-breaker

The compiler retains provenance: `source` names the winning scope and
`shadowed[]` lists every lower-precedence decision (`decisionId`, `scope`,
`mode`, `resourceId`, `priority`).

## Slots

Use stable slot keys, not display labels (`decisionSlotSchema`: lowercase,
namespaced, e.g. `frontend.framework`, `custom.date_library`). The Stack screen
groups known slots (`apps/web/lib/decision-slots.ts`).

## Canonical output (0.3.0)

```json
{
  "compilerVersion": "0.3.0",
  "project": { "id": "…", "name": "…", "slug": null, "description": null, "productType": null, "stage": "mvp", "platforms": [], "priorities": [] },
  "decisions": [
    {
      "slot": "frontend.framework",
      "mode": "LOCKED",
      "source": "project",
      "origin": null,
      "decisionId": "…",
      "resource": { "id": "…", "name": "Next.js", "type": "framework", "sourceUrl": "…", "installCommand": null, "archived": false },
      "priority": 0,
      "constraints": {},
      "rationale": null,
      "shadowed": [
        { "decisionId": "…", "scope": "profile", "mode": "PREFERRED", "resourceId": "…", "priority": 0, "origin": { "id": "…", "name": "Fast SaaS", "priority": 5 } },
        { "decisionId": "…", "scope": "global", "mode": "PREFERRED", "resourceId": "…", "priority": 0, "origin": null }
      ]
    }
  ],
  "resources": [
    { "id": "…", "name": "Next.js", "type": "framework", "slug": "…", "description": null, "sourceUrl": "…", "docsUrl": null, "repoUrl": null, "installCommand": null, "archived": false, "attached": true, "slots": ["frontend.framework"] }
  ],
  "rules": ["Prefer boring technology."],
  "warnings": [{ "code": "RESOURCE_ARCHIVED", "slot": "frontend.ui.base", "resourceId": "…", "message": "…" }]
}
```

- `decisions` sorted by slot; `resources` by lower-cased name then id;
  `warnings` by code, slot, resource.
- `rules` holds the Project's explicit engineering rules in the owner's order.
- `origin` names the Profile (later Recipe) behind a decision, with the
  attachment priority that ranked it.
- Private Resource notes are never part of the canonical object.
- `stableStringify` (recursively sorted keys, two-space indent) and
  `hashCanonical` (SHA-256 hex, `@devcontext/context-compiler/hash`) define the
  stored hash. No timestamps live inside the canonical object.

## Warning codes

| Code | Meaning |
| --- | --- |
| `RESOURCE_UNRESOLVED` | a winning decision or attachment references a Resource that is not in the input |
| `RESOURCE_ARCHIVED` | a selected or attached Resource is archived in the Library |
| `RESOURCE_CONFLICT` | the same Resource is `DISABLED` in one slot and `LOCKED`/`PREFERRED` in another |
| `DISABLED_RESOURCE_ATTACHED` | an attached Resource is disabled by a decision and therefore excluded |
| `RULE_CONFLICT` | a curated `conflicts` rule matches two Resources that are both active |
| `MISSING_REQUIREMENT` | a curated `requires` rule's left Resource is active but the required one is not |

Warnings are informational. The compiler never deletes or rewrites decisions.
Compatibility rules (`compatibilityRules` input, owner-curated) are evaluated
against the active stack only.

## Export phase

Exporter adapters consume only the canonical object:
- generic master prompt (`PROJECT_CONTEXT.md`)
- Codex / `AGENTS.md`
- Claude / `CLAUDE.md`
- Cursor `.cursor/rules/devcontext.mdc`
- Copilot `.github/copilot-instructions.md`

All adapters wrap the same generic body: brief, how to read the modes, locked
decisions, preferred defaults, delegated decisions, do-not-use list, reference
resources with exact URLs and install commands, warnings and working rules.
Exporters must not change decision semantics.

## Versioning

- `COMPILER_VERSION` is stored with every context version.
- The API stores a new Project version only when the canonical hash changes;
  identical input never creates version noise.
- A compiler change that alters ordering or semantics increments the version,
  regenerates the golden snapshots and `examples/generated-context`, and is
  documented in the handoff report.

Compiler history:
- `0.1.0` — starter: flat decisions with shadowed IDs, string warnings.
- `0.2.0` — Handoff 6: structured provenance, active resource list with
  attachments, structured warnings, stable ordering/hashing, five adapters.
- `0.3.0` — Handoff 7: `origin` (Profile/Recipe id, name, attachment priority)
  on decisions and shadowed entries, attachment priority ranks before decision
  priority inside a scope, Project `rules` flow into canonical `rules`.
- `0.4.0` — Handoff 8A: curated compatibility rules produce `RULE_CONFLICT` and
  `MISSING_REQUIREMENT` warnings; `@devcontext/context-compiler/diff` adds the
  semantic `diffContexts()` used by the context diff API.

Handoff 9 correction (`0.4.1`): a `LOCKED`, `PREFERRED` or `DISABLED` decision
whose Resource was deleted (`resourceId: null`) emits `RESOURCE_UNRESOLVED`.
Portable import/export preserves its mode, constraints and rationale. The
decision is never silently delegated. Existing stored versions are untouched;
the next compile receives a new hash. Goldens and published examples were
regenerated from the compiler.

## LLM usage

V0–V1 deterministic only.

V1.5 optional LLM pass may:
- improve prose
- summarize rationale
- propose fixes

It may **not** change canonical decisions.

## Testing

Golden fixtures are mandatory and live in
`packages/context-compiler/test/golden.test.ts` (snapshots) and
`examples/generated-context` (`project.json` → `expected-canonical.json`,
`EXPECTED_MASTER_PROMPT.md`):
- global-only
- project overrides recipe, profile and global
- AI_DECIDE
- disabled resource (with conflict and attachment warnings)
- component preference with exact URL and install command
- recipe placeholder
- deterministic sort/order and byte-stable hash
