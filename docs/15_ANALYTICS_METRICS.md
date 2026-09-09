# 15 — Product Analytics & Metrics

## North-star candidate

**Projects with at least one successful context export per active user per month.**

This measures whether stored context turns into actual development work.

## Activation

A user is activated when they:
1. save >= 5 resources
2. create a project
3. compile context
4. export/copy at least one target

## Events

- signup_completed
- resource_created
- resource_preference_set
- profile_created
- project_created
- decision_changed
- context_compiled
- context_exported
- recipe_applied
- resource_saved_from_discover
- ai_recommendation_requested
- ai_recommendation_accepted

## Implementation status (Handoff 8B)

Emitted as structured API log lines (`category: "analytics"`, `event`, `userId`,
`requestId`, `properties`) with identifiers, enum values and counts only:
`signup_completed`, `resource_created`, `resource_preference_set`,
`profile_created`, `project_created` (also for clones), `decision_changed`,
`context_compiled`, `context_exported`. `recipe_applied`, Discover and AI events
arrive with their features. A log shipper or a later provider adapter turns the
lines into funnels; no third-party SDK receives user data today.

## Funnel

Signup
→ first resource
→ first project
→ first compile
→ first export
→ second project

The second-project rate is especially important: it validates reusability.

## Retention hypotheses

Users return because:
- new projects reuse old context
- Library becomes valuable over time
- saved exact components reduce repeated searching
- context changes stay synchronized
