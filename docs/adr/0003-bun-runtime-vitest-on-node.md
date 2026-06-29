# Bun as package manager; Node as the server runtime

We use **Bun** (1.3.x) as the package manager and script runner (`bun install`, `bun.lock`, `bun run …`), but the application — **dev server, build, tests, and the production SSR server — runs on Node**. The build uses Nitro's default **`node-server`** preset and is started with `node ./.output/server/index.mjs`. The Postgres driver is **`postgres` (postgres.js)**. This keeps Bun's fast install/run while deviating from the PRD's pnpm only on the package-manager axis.

**Why Node for the server (not Bun):**
- The performance upside of a Bun server is marginal for this workload: cold-start is irrelevant on a long-lived Railway container, the site is read-heavy and CDN-fronted (Cloudflare + Railway HTML cache), and SSR cost is React render + DB latency, not HTTP throughput. The DB driver is postgres.js either way (`bun-sql` rejected for a concurrent-statement bug), so there's no Bun-native DB win.
- Node is the most battle-tested runtime for React 19 streaming SSR + the npm ecosystem, which matters for a public production server — especially since we pin a Nitro **nightly** (bun-preset + nightly is the least-proven combination).
- Observability (§5, locked): `@sentry/node` is materially more mature than `@sentry/bun`, and the Phase-3 workers run on Node regardless — so a Node web server means one `@sentry/node` across the whole compute tier.
- Consistency: Vitest, drizzle-kit, the importer, the catalog-sync cron, and the Phase-3 workers all run on Node anyway. A Bun web server would *split* the runtimes; Node-server keeps **one execution runtime across server + tests + workers + scripts**, with Bun purely as the installer/runner.

**Why Vitest on Node, not `bun test`:** §16 depends on Vitest sharing the Vite pipeline (identical resolution to the app) and the PGlite integration design. We invoke it as `bun run test` (= `vitest run`), which runs on Node via the bin shebang. Never `bun test` (Bun's own runner) or `bun --bun vitest`.

**Considered and rejected:** Bun as the server runtime via Nitro's `bun` preset (officially supported, and we verified it builds + boots) — rejected because its upside is marginal here while it adds production-maturity, Sentry, and nitro-nightly risk. Also rejected: staying on pnpm+Node (works, matches the PRD, but no single-tool install/run win).

**Escape hatch / reversibility:** the Bun server path is one flag away — set `NITRO_PRESET=bun`, start with `bun run ./.output/server/index.mjs`, and use a Bun runtime stage in the Dockerfile. Keep this in mind if a future, runtime-bound need appears.

**Deploy consequence:** Railway's builders don't auto-detect Bun, so deployment uses an explicit **Dockerfile** — Bun builds, a `node` slim image runs the `.output`.
