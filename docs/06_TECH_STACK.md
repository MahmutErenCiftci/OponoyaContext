# 06 — Recommended Tech Stack

## Decision summary

### Monorepo
- pnpm workspaces
- Turborepo
- TypeScript

Why:
- simple shared packages
- easy for coding agents to navigate
- shared contracts/types
- independent app builds
- no microservice operational tax

### Runtime
- Node.js 26.8.1 Current stable (owner-requested upgrade; see document 26)

### Web
- Next.js 16.x
- React
- TypeScript
- Tailwind CSS
- shadcn/ui when UI implementation starts

Why:
- strong ecosystem
- good server/client ergonomics
- agent-friendly conventions
- mature component ecosystem

### API
- Fastify 5.x
- Zod validation/contracts

Why not Next.js-only backend?
The product will eventually serve CLI, extensions, integrations, webhook flows and potentially an MCP server. A dedicated API boundary is useful without requiring microservices.

Why not NestJS?
More ceremony than this MVP needs.

Why not Go initially?
Go is excellent, but keeping web/API/shared compiler logic in TypeScript reduces context switching and speeds AI-assisted MVP delivery. A high-load service can be split later if metrics justify it.

### Database
- PostgreSQL 18.x
- Drizzle ORM 0.45.x stable line

Why:
- relational model fits projects/resources/decisions/version history
- JSONB available for flexible metadata
- mature indexing
- easy future vector support if needed
- Drizzle keeps SQL visible

### Authentication
- Better Auth 1.7.x

Start:
- email/password or magic link
- social login optional

Later:
- organizations
- enterprise auth only when Team plan exists

### Cache / queue
MVP: **none**.

Add Redis only when there is a measured need:
- rate-limit distribution across instances
- job queue
- heavy cache
- presence/realtime

Background enrichment V1.5 can start with DB-backed jobs before Redis if load is small.

### Search
MVP:
- PostgreSQL trigram/full-text where needed

Do not add Elasticsearch/Meilisearch initially.

### Object storage
Only needed when screenshots/uploads arrive:
- S3-compatible storage / Cloudflare R2

Do not require it for V0.1.

### Payments
V1.0:
- payment provider abstraction at application layer
- choose commercial provider based on company/payment geography at launch time
- do not deeply couple billing logic to one vendor

### Deployment

Recommended MVP:
- Web: Vercel or containerized Next.js
- API: Docker on managed platform/VPS
- PostgreSQL: managed PostgreSQL preferred for production
- Cloudflare in front for DNS/WAF where appropriate

For lowest operational complexity, managed DB is strongly preferred over self-hosting production Postgres.

### Observability
- Sentry or equivalent for errors
- structured JSON logs
- uptime checks
- basic product analytics

### Testing
- Vitest
- Fastify inject for API integration tests
- Playwright for critical E2E flows

## Tech we intentionally avoid in MVP

- microservices
- Kubernetes
- Kafka
- GraphQL
- CQRS/MediatR-style command buses
- event sourcing
- Elasticsearch
- multiple databases
- custom auth
- custom design system from zero

## Upgrade policy

- pin production lockfile
- security updates quickly
- framework minor upgrades intentionally
- never allow an AI coding agent to mass-upgrade dependencies without reviewing release notes and tests
