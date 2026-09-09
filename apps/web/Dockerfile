# syntax=docker/dockerfile:1.7
# DevContext web image (Handoff 12). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t devcontext-web:<release> .
# Next.js standalone output; the API is reached server-side through API_URL.
ARG NODE_VERSION=26.8.1
ARG PNPM_VERSION=12.3.4

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV CI=true NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
RUN npm install --global --no-audit --no-fund pnpm@${PNPM_VERSION}
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @devcontext/web...

FROM deps AS build
COPY tsconfig.base.json tsconfig.json ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
# Public browser configuration only; server-only variables are read at runtime, never baked in.
RUN pnpm --filter @devcontext/web... build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system app && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/web/server.js"]
