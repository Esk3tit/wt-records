# Bun is only the dependency installer (fast, frozen lockfile). The build and
# the SSR server both run under Node: Nitro picks its srvx server adapter from
# the build-time runtime, so building under Bun would bake in Bun.serve and
# crash under Node. Railway doesn't auto-detect Bun, so we ship this image.
FROM oven/bun:1.3.14 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run generate-routes && npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Nitro's node-server output is self-contained; no node_modules needed.
COPY --from=build --chown=node:node /app/.output ./.output
# Run as the image's non-root user.
USER node
# Nitro honors $PORT (set by Railway); defaults to 3000 locally.
EXPOSE 3000
CMD ["node", "./.output/server/index.mjs"]
