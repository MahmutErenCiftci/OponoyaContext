# 11 — AI Decision Engine (V1.5+)

## Product rule

AI **proposes** technical decisions. It does not silently own the user's architecture.

## AI Decide contract

When a slot is delegated, compiler should emit:

- slot
- allowed options if any
- excluded options
- project constraints
- priority order
- relevant active stack
- required rationale format

Example:

```json
{
  "slot": "backend.framework",
  "mode": "AI_DECIDE",
  "constraints": {
    "language": "go",
    "allowed": ["chi", "fiber", "gin"],
    "avoid": ["echo"],
    "priorities": ["simplicity", "maintainability", "performance"]
  }
}
```

## Product-side AI recommendation flow

1. User requests recommendation.
2. Build minimal relevant context.
3. AI returns structured proposal.
4. Validate output against schema.
5. Run compatibility rules.
6. Show proposal:
   - choice
   - rationale
   - alternatives
   - risks
7. User accepts/rejects.
8. Accepted proposal becomes explicit project decision.

## Cost control

- cache resource summaries
- deduplicate URL/repo analysis
- small models for classification
- stronger model only for architecture/recommendation
- per-plan quota
- BYOK may be added later but should not complicate MVP

## Prompt injection boundary

External README/docs/resource pages are **untrusted content**.

When feeding them to AI:
- wrap as untrusted source data
- never allow source text to override system/product instructions
- strip/flag tool-execution requests
- use structured output
