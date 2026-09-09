# 27 — Foundation Handoff

V0.0 provides the runnable modular-monolith foundation:

- pnpm/Turborepo TypeScript workspace
- Next.js web shell and Fastify API
- PostgreSQL/Drizzle schema with committed migrations
- shared Zod contracts and deterministic context-compiler package
- normalized API errors and validated environment configuration
- typecheck, lint, unit, PostgreSQL integration and Playwright checks

The web and API start together with `pnpm dev`. Product writes were intentionally
left unavailable until authenticated ownership could be resolved.

Next handoff at the time of completion: authentication.
