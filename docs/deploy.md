# Deploy runbook (Railway)

The SSR app deploys to Railway from `main` via the [`Dockerfile`](../Dockerfile). `/` is a 307 redirect to the default mode's landing (`/grb`); every content page renders through the database, so the DB must be **reachable, migrated, and — for a non-empty site — seeded** before a deploy can pass its healthcheck.

## Required Railway variables (production service)

- **`DATABASE_URL`** — any reachable Postgres; two known-good values:
  - **Railway managed Postgres** (current): the `${{Postgres.DATABASE_URL}}` variable reference — private networking, no external pooler in the path. Stand a fresh one up per [Vanilla Postgres](#vanilla-postgres-any-non-supabase-host) below.
  - **Supabase Transaction pooler** (Supavisor): host `…pooler.supabase.com`, port **6543**, user `postgres.<ref>`. The client sets `prepare: false` for it.
    - Do **not** use the **direct** host (`db.<ref>.supabase.co:5432`) — it's IPv6-only and Railway egresses over IPv4, so the connection hangs.
    - Do **not** paste the local `postgresql://…@127.0.0.1:54322/…` value.
- `SUPABASE_URL`; plus `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` once Realtime/Auth land (Phase 2).
- `SENTRY_DSN` and the `VITE_*` observability keys.

## Apply migrations

The app never self-migrates. Committed migrations reach production via the **`migrate-prod`** GitHub Action, which pauses on the `WT Records / production` environment's required-reviewer gate and — once approved — runs `bun run db:migrate` against the `PROD_MIGRATE_DATABASE_URL` secret (a Session-pooler/Direct URL). Two triggers:

- **Automatically on merge to `main`** when anything under `drizzle/` changes. A bad migration can't reach here — the per-PR migration check blocks it at review time.
- **Manually** (Actions tab → _migrate-prod_ → _Run workflow_, confirm with `migrate`) for re-runs or out-of-band migrations.

Railway deploys the same merge in parallel and does **not** wait for the migration, so approve promptly — especially when new code depends on the new schema.

As a local last resort, migrate **through the Session pooler or Direct connection** — *not* the transaction pooler, because `drizzle-kit` uses prepared statements the transaction pooler rejects:

```bash
DATABASE_URL='<session-pooler (port 5432) or direct URL>' bun run db:migrate
```

## Seed (optional)

Seeding is **optional** — an empty-but-migrated DB already passes the healthcheck (the home renders); the `/$mode` pages just 404 until the `modes` rows exist.

`db:seed` sets `prepare: false`, so — unlike `db:migrate` — it works fine through the **transaction pooler** `DATABASE_URL` (no session/direct requirement). It writes FAKE fixture data, so seeding any non-local database requires an explicit `SEED_REMOTE=1`:

```bash
SEED_REMOTE=1 DATABASE_URL='<hosted transaction-pooler URL>' bun run db:seed   # dev fixture — FAKE data
SEED_RESET=1 SEED_REMOTE=1 DATABASE_URL='<hosted transaction-pooler URL>' bun run db:seed   # wipe fixture tables first (seed is not idempotent)
```

Real GRB data lands via the importer (#20).

## Vanilla Postgres (any non-Supabase host)

Nothing at runtime uses Supabase-specific services yet (Realtime and Auth are future phases), so any Postgres serves the app once the Supabase-provided objects are shimmed in — the same recipe the per-PR migration check runs against a fresh `postgres` container. Against a direct (non-transaction-pooler) URL:

```bash
export DATABASE_URL='<direct connection URL>'
node scripts/prepare-vanilla-pg.mjs   # auth schema/roles shim + realtime publication
bun run db:migrate
SEED_REMOTE=1 bun run db:seed
```

Switching the app between providers is then just repointing the service's `DATABASE_URL`. When doing so, also repoint the `PROD_MIGRATE_DATABASE_URL` secret (see [Apply migrations](#apply-migrations)) — otherwise merges keep migrating the old provider's database and the live one drifts.

## Deploy

Merge to `main` → Railway builds the Dockerfile and deploys. **Migrations must already be applied to the hosted DB** (above) before/with the deploy.

## If a deploy fails at the healthcheck

The Railway healthcheck must target a path that answers 200 (`healthcheckPath` is `/healthz`; `/` only 307s to `/grb`). Diagnose in this order:

0. **Healthcheck probes `/healthz`** — app liveness + a 2s-bounded DB ping that reports (but does not fail on) database state, so deploys are not hostage to provider brownouts. The scheduled `prod watchdog` workflow separately probes the real landing every 30 min and opens/closes a `watchdog` issue with provider-status context.
1. **Requests hang with no errors anywhere, while lightly-loaded routes still serve:** the pooler is stalling NEW connection establishment (established ones keep working) — a provider brownout, not an app bug. `connect_timeout` now turns these into fast 500s + Sentry events. Check status.supabase.com first; redeploy after it clears.
1. **Hangs, no error (~5 min):** the DB connection can't be established → `DATABASE_URL` is the local/direct host, not the IPv4 pooler.
2. **Fast 5xx ("service unavailable"):** the DB is reachable but a query throws → schema not migrated (`relation "modes" does not exist`), or the pooler password placeholder wasn't filled.

Runtime SSR errors aren't logged (TanStack turns a loader throw into a 500), so use the two symptoms above rather than expecting a stack trace.
