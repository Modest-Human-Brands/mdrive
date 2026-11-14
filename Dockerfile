FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY nitro.config.ts ./

ARG SITE_URL

ENV NITRO_PRESET=bun
ENV NITRO_PUBLIC_SITE_URL=$SITE_URL

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:1-alpine AS runner

ARG VERSION
ARG BUILD_TIME

WORKDIR /app

COPY --from=builder /app/.output ./.output

ENV NODE_ENV=production
ENV NITRO_APP_VERSION=$VERSION
ENV NITRO_APP_BUILD_TIME=$BUILD_TIME

ENV PORT=3004

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3004/api/health || exit 1

ENTRYPOINT ["bun", ".output/server/index.mjs"]