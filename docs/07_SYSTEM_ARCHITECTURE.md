# 07 — System Architecture

## High-level

```text
Browser
   |
   v
Next.js Web
   |
   v
Fastify API
   |
   +--------------------+
   |                    |
   v                    v
PostgreSQL        External providers
                  (later: GitHub, AI, billing)
```

This is a **modular monolith**.

`apps/api` has one deployable process, but domain modules are separated so high-load boundaries can be extracted later.

## API modules

- auth
- users
- resources
- tags
- profiles
- recipes
- projects
- decisions
- compatibility
- compiler
- exports
- integrations
- billing (V1)
- discovery (V1.2)
- ai-enrichment (V1.5)

## Layering per module

```text
route/controller
      |
      v
service/use-case
      |
      v
repository
      |
      v
database
```

Domain logic must not depend directly on Fastify request objects.

## Context Compiler

The compiler is deliberately in a shared pure package.

Inputs:
- global preferences
- selected profiles
- recipe
- project decisions
- resource metadata

Output:
- canonical compiled context JSON

Exporter adapters consume only canonical context.

This lets us:
- test it without a server
- run it in API/CLI later
- create an MCP server later
- diff versions safely

## Write consistency

For actions such as:
- create project + decisions
- apply recipe
- replace stack resource + dependent decisions

use a DB transaction.

## Version history

Every successful compile creates:
- canonical context JSON
- content hash
- compiler version
- project version number
- created timestamp

Skip duplicate versions when hash does not change.

## Background work

V0/V1:
synchronous for cheap deterministic work.

V1.5 AI enrichment:
- create job record
- worker claims job
- store result
- retry with bounded attempts

Do not block user writes on expensive AI enrichment.

## Scaling path

### < 10k active users
- one API service
- one web service
- managed PostgreSQL
- object storage if needed

### More load
Scale API horizontally.

Add:
- distributed rate limiter
- queue
- read replica only when measured

### Extraction candidates
Only if justified:
- discovery crawler/indexer
- AI enrichment worker
- public API/MCP gateway

Core projects/resources/decisions should remain together as long as practical.
