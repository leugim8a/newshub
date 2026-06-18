# NewsHub — Production Dockerfile (Next.js 15 standalone)

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable pnpm
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
ARG SOURCE_COMMIT
RUN COMMIT_SHA=$(echo "${SOURCE_COMMIT:-$(cat .commit 2>/dev/null || echo unknown)}" | cut -c1-7) \
    && BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
    && mkdir -p apps/web/public \
    && echo "{\"commit\":\"$COMMIT_SHA\",\"builtAt\":\"$BUILT_AT\"}" > apps/web/public/build-info.json \
    && NEXT_PUBLIC_COMMIT_SHA=$COMMIT_SHA NEXT_PUBLIC_BUILT_AT=$BUILT_AT \
       pnpm --filter @newshub/web build

# --- Production ---
FROM base AS production
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /app/packages/db/migrations ./packages/db/migrations
COPY --from=build --chown=node:node /app/packages/db/src/migrate.js ./packages/db/src/migrate.js
RUN cd packages/db && npm init -y >/dev/null 2>&1 && npm install pg >/dev/null 2>&1

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["dumb-init", "sh", "-c", "node packages/db/src/migrate.js && exec node apps/web/server.js"]
