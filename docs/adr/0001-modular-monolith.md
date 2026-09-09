# ADR 0001 — Modular Monolith

Status: Accepted

## Context
We need fast MVP delivery and clear boundaries without distributed-system cost.

## Decision
One Fastify API deployable with domain modules. Shared compiler is a package.

## Consequences
Positive:
- easy local development
- simple transactions
- fewer failure modes
- AI agents can reason across codebase

Negative:
- eventual hot modules may require extraction

## Trigger for reconsideration
Measured independent scaling/deployment need, not hypothetical future scale.
