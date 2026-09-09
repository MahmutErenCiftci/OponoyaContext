# 03 — Critical User Flows

## Flow A — First-time onboarding

1. Sign up.
2. Choose experience:
   - I know my stack
   - Let me start lightweight
3. Optionally select 5–10 common resources.
4. Create one Design Profile or skip.
5. Create first project.
6. Generate first context.
7. Copy/download one export.
8. Show value moment: "You can now change the project stack without rewriting these instructions."

Do not ask for dozens of preferences during onboarding.

## Flow B — Save a specific component

Example: user wants Animate UI Toggle as their normal Toggle.

1. `Add Resource`
2. Paste URL.
3. System extracts title/source where possible.
4. User chooses:
   - type: component
   - slot: toggle
5. Set default usage:
   - `PREFERRED`
6. Optional:
   - install command
   - required libraries
   - notes
7. Save to Library.
8. On future Project Wizard UI step, surface it under preferred components.

## Flow C — Create project manually

1. Project basics.
2. Select frontend.
3. Select backend.
4. Select data.
5. Select design.
6. Delegate some slots to AI.
7. Select coding agent.
8. Review.
9. Create.
10. Compile context.

## Flow D — Create from recipe

1. Select recipe.
2. Enter project basics.
3. Review inherited decisions.
4. Override specific items.
5. Create.
6. Compile context.

## Flow E — Change technology after project creation

Example:
`Go + Fiber` → `TypeScript + Fastify`

1. User changes backend language.
2. Compatibility engine finds dependent choices:
   - Go-only package
   - sqlc
3. UI shows impact summary.
4. User resolves or accepts recommended replacements.
5. Save transaction.
6. Context version increments.
7. Show generated-context diff.

Never silently remove user decisions.

## Flow F — AI Decide

1. Slot mode = `AI_DECIDE`.
2. User may constrain:
   - allowed options
   - excluded options
   - priorities
3. Context compiler emits a decision contract.
4. Coding agent can choose.
5. Later, if product integrates AI recommendation directly:
   - proposal is recorded separately
   - user accepts/rejects
   - accepted decision becomes a project decision

## Flow G — Export to coding agent

1. User opens Context.
2. Select target:
   - Generic
   - Codex
   - Claude Code
   - Cursor
   - Copilot
3. Preview files.
4. Copy individual file or export bundle.
5. Record export event.
