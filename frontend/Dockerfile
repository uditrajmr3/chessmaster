# ChessMaster frontend — Next.js, built for the standalone runtime output
# (see next.config.mjs: `output: "standalone"`) and served behind Caddy in
# production. Multi-stage build keeps the final image to just the traced
# server bundle + static assets + public files, no full node_modules tree.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copies the Stockfish WASM engine out of node_modules/stockfish/bin into
# public/stockfish/ (see scripts/fetch-stockfish.mjs). Those files are
# gitignored and MUST exist before `next build` runs, because the final
# stage below copies the built `public/` directory verbatim — if
# fetch-stockfish hasn't run yet, public/stockfish/ is empty and the
# position analyzer's client-side engine 404s in production.
RUN npm run fetch-stockfish

# BACKEND_URL is read at build time by next.config.mjs to bake the /api/*
# rewrite destination into the build output. In this compose topology Caddy
# already splits /api/* to the api service before requests ever reach
# Next.js, so this mainly matters as a defensive fallback — set it to
# http://api:8000 (the backend's internal compose hostname) via the build
# arg below, sourced from the root .env through docker-compose.prod.yml.
ARG BACKEND_URL
ENV BACKEND_URL=${BACKEND_URL}

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone server output: a minimal server.js plus only the node_modules
# each route actually traced as a dependency.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static JS/CSS chunks — not included in the standalone trace, must be
# copied alongside it.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets, including public/stockfish/*.js + *.wasm fetched above.
# Standalone output does NOT copy `public/` automatically — this has to be
# an explicit step, and it must happen after fetch-stockfish ran in the
# builder stage.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
