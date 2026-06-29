# Bun is the package manager/builder; Node runs the SSR server (Nitro
# node-server preset). Railway doesn't auto-detect Bun, so we ship this image.
FROM oven/bun:1.3.14 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run generate-routes && bun run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Nitro's node-server output is self-contained; no node_modules needed.
COPY --from=build /app/.output ./.output
# Nitro honors $PORT (set by Railway); defaults to 3000 locally.
CMD ["node", "./.output/server/index.mjs"]
