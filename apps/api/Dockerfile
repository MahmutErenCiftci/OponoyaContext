# syntax=docker/dockerfile:1.7
# DevContext API image (Handoff 12). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t devcontext-api:<release> .
# Runtime is the repository-pinned Node (.node-version / package.json engines).
ARG NODE_VERSION=26.8.1
ARG PNPM_VERSION=12.3.4

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV CI=true NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
RUN npm install --global --no-audit --no-fund pnpm@${PNPM_VERSION}
WORKDIR /repo

# Dependencies: only manifests, so the layer is reused until the lockfile changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/catalog/package.json packages/catalog/
COPY packages/context-compiler/package.json packages/context-compiler/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @devcontext/api...

# Build: workspace packages first (tsc), then a pruned production copy.
FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY data ./data
COPY apps/api ./apps/api
RUN pnpm --filter @devcontext/api... build \
 && pnpm --filter @devcontext/api deploy --prod --legacy /out

# Runtime: production dependencies and built output only, non-root, health-checked.
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=4000
RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || 4000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Migrations are a release step, not a boot step: run
#   docker run --rm --env-file <env> devcontext-api:<release> node node_modules/@devcontext/db/dist/migrate.js
CMD ["node", "dist/server.js"]
