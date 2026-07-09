# WT Records

Public, server-rendered world-record registry & leaderboard for War Thunder — most kills in a single life, per vehicle, **per game mode** (launching with Ground Realistic Battles). Replaces a Google Sheet + ad-hoc Discord intake with a fast, searchable, shareable site.

**Stack:** [TanStack Start](https://tanstack.com/start) (React SSR, file routing, Vite/Nitro) · **Bun** (package manager + script runner) · **Node** (server + test runtime) · Supabase (Postgres, Auth, Realtime) · Cloudflare R2 (proof/asset storage) · Drizzle ORM · Railway · CI on GitHub Actions. Why Bun-installs-but-Node-runs: [ADR-0003](./docs/adr/0003-bun-runtime-vitest-on-node.md).

## Source of truth

- **[`CONTEXT.md`](./CONTEXT.md)** — domain glossary (ubiquitous language).
- **[`docs/adr/`](./docs/adr/)** — architecture decision records.

The product spec (PRD) and build handoff are maintained outside the repo (not committed).

## Quick start

Prerequisites: **[Bun](https://bun.com/docs/installation) ≥ 1.3** (package manager + runtime) and **Node ≥ 20** (Vitest runs on Node; see `.nvmrc`).

```bash
bun install           # install dependencies (frozen in CI)
cp .env.example .env  # fill in as services come online (PR2+)
bun run dev           # start the dev server at http://localhost:3000
```

The app was scaffolded with the TanStack CLI; to regenerate the base:

```bash
bunx @tanstack/cli@latest create wt-records \
  --framework React --package-manager bun --toolchain eslint \
  --no-examples --deployment railway
```

> Local database: PR1 needs none — `bun run test` runs pure logic plus a node smoke test, no DB. PGlite-backed integration tests arrive in PR2; Phase 2+ dev runs against a local Supabase stack (`supabase start`, Docker).

## Scripts

| Command                           | What it does                                         |
| --------------------------------- | ---------------------------------------------------- |
| `bun run dev`                     | Dev server (HMR) on port 3000 (Vite on Node)         |
| `bun run build` / `bun run start` | node-server SSR build / run it on Node               |
| `bun run typecheck`               | `tsc --noEmit` (strict)                              |
| `bun run lint`                    | ESLint (flat config)                                 |
| `bun run test`                    | Vitest (on Node) — both projects                     |
| `bun run test:unit`               | Vitest `unit` project only (jsdom)                   |
| `bun run test:integration`        | Vitest `integration` project only (node)             |
| `bun run generate-routes`         | Regenerate `src/routeTree.gen.ts`                    |
| `bun run check`                   | Prettier formatting check (CI-enforced)              |
| `bun run db:migrate`              | Apply committed Drizzle migrations to `DATABASE_URL` |
| `bun run db:seed`                 | Apply the dev fixture (fake data) to `DATABASE_URL`  |

## Testing

Set up from the first commit, not retrofitted. Two Vitest projects in one repo ([`vitest.config.ts`](./vitest.config.ts)):

- **`unit`** (jsdom) — React components + pure logic (`src/**/*.test.{ts,tsx}`).
- **`integration`** (node) — server/DB tests against in-process PGlite (`tests/integration/**`). PR2 fills this with tests that replay the committed Drizzle migrations.

Slower checks (Playwright E2E, visual, LLM evals) run non-blocking on previews/nightly per PRD §16.

## CI

`.github/workflows/quick-checks.yml` is the **required** fast check (target 2–4 min, blocks merge): `bun install --frozen-lockfile` → `generate-routes` → `typecheck` → `lint` → `check` (Prettier) → `test`.

**Deploy:** to Railway from `main` via the [`Dockerfile`](./Dockerfile) (`oven/bun` base; Railway doesn't auto-detect Bun). Every page renders through the DB, so the hosted database must be migrated first (seed it only when you need fixture data) — see the **[deploy runbook](./docs/deploy.md)** (env vars, the transaction-pooler `DATABASE_URL`, and the manual migration step CI doesn't run).

## Project structure

```
src/
  components/   # React components (e.g. Brand wordmark)
  db/           # Drizzle schema + migrations (PR2)
  lib/          # framework-agnostic utilities (env, observability seam, slug)
  routes/       # file-based routes (PR3)
tests/
  setup.unit.ts
  integration/  # PGlite integration tests (PR2)
docs/adr/       # architecture decision records
```

## Status

**Phase 1** — public read site + one-time GRB migration + a minimal moderator CMS. Public submissions (Phase 2) and the automated screenshot-verification pipeline (Phase 3) are deferred; the schema is built to accept them. Tracked in [GitHub Issues](https://github.com/Esk3tit/wt-records/issues) under the _Phase 1_ milestone.
