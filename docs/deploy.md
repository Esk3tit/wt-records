# Deploy runbook (Railway)

The SSR app deploys to Railway from `main` via the [`Dockerfile`](../Dockerfile). `/` is a 307 redirect to the default mode's landing (`/grb`); every content page renders through the database, so the DB must be **reachable, migrated, and — for a non-empty site — seeded** before a deploy can pass its healthcheck.

## Required Railway variables (production service)

- **`DATABASE_URL`** — any reachable Postgres; two known-good values (set the **same value on the `catalog-sync` service**, or the cron syncs a different database than the site serves):
  - **Supabase Session pooler** (current): host `…pooler.supabase.com`, port **5432**, user `postgres.<ref>` — IPv4, and each connection holds a dedicated backend, so it behaves like direct Postgres. This is the right mode for this app: one long-lived server holding a ~10-connection pool.
    - Do **not** use the **Transaction pooler** (same host, port **6543**) to serve the app. postgres-js pipelines concurrent queries onto its sockets, and Supavisor's transaction mode hangs at ≥ ~4 in flight — the mode landing fires an ~11-query burst, so exactly that page times out while every lighter page works (verified by probe 2026-07-08; single queries 20–300ms, any 11-query burst hangs at every pool size). Transaction mode exists for the many-short-lived-clients shape (serverless), which this app is not.
    - Do **not** use the **direct** host (`db.<ref>.supabase.co:5432`) — it's IPv6-only and Railway egresses over IPv4, so the connection hangs.
    - Do **not** paste the local `postgresql://…@127.0.0.1:54322/…` value.
  - **Railway managed Postgres**: the `${{Postgres.DATABASE_URL}}` variable reference — private networking, no external pooler in the path. Stand a fresh one up per [Vanilla Postgres](#vanilla-postgres-any-non-supabase-host) below.
- `SUPABASE_URL`; plus `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` once Auth lands (Phase 2).
- **`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`** — the browser Realtime client (live feed + leaderboard refetch). Build-time vars like the other `VITE_*` keys (Vite inlines them; a change requires a redeploy). The anon key is public by design — RLS lets it read only verified+current records, and the client is Realtime-only (ADR 0006). Absent keys degrade silently to the static SSR site. **Caveat:** Realtime streams the *Supabase* database's changes — while `DATABASE_URL` points anywhere else (incident fallback), live events won't match what the site serves, so leave these unset in that state.
- `SENTRY_DSN` and the `VITE_*` observability keys.
- The `R2_*` proof/asset storage vars (see `.env.example` for names and defaults) — set on **both** the web service and the `catalog-sync` service (the cron mirrors vehicle images). The token is scoped Object Read & Write to exactly the three buckets; verify with `bun run r2:verify` after any rotation.
- **`CATALOG_GITHUB_TOKEN`** — on the **`catalog-sync` service only**. Anonymous GitHub reads get 60 requests/hour keyed on the *IP*, and Railway's egress IP is shared, so other tenants can spend that budget before the cron wakes; the 2026-08-01 run died on its first request that way. Authenticating raises that to 5,000/hour — but note the budget belongs to the **account**, not the token: every token, OAuth app and script acting as that user draws on the same 5,000, so don't assume the cron has it to itself. Mint a **fine-grained** token scoped to public-repository read only, with expiration set to none (GitHub allows infinite lifetimes and recommends fine-grained over classic, which would carry access to every repository the owner can reach). The sync sends it only to `api.github.com` and `raw.githubusercontent.com`. An expired or revoked token is *worse* than none — GitHub answers `401`, which the sync treats as non-transient and dies on, where anonymous would at least have had a chance. That failure is loud and self-describing (the watchdog issue quotes `Bad credentials`), but it is still a night of staleness on a timer. Only two states fall back to anonymous: the variable unset, and a value no HTTP header could carry (that one is dropped unsent, because a rejected header quotes what it rejected and the watchdog copies run details into a public issue). Every other value — a typo, a placeholder, a truncated paste — is sent, and GitHub's verdict on it stands. The sync does not try to recognise a well-formed token; that is GitHub's job, and guessing at it would only fail differently when the token formats change.

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

`db:seed` sets `prepare: false` and runs its statements sequentially, so it works through any pooler mode — just reuse the session-pooler URL. It writes FAKE fixture data, so seeding any non-local database requires an explicit `SEED_REMOTE=1`:

```bash
SEED_REMOTE=1 DATABASE_URL='<session-pooler URL>' bun run db:seed   # dev fixture — FAKE data
SEED_RESET=1 SEED_REMOTE=1 DATABASE_URL='<session-pooler URL>' bun run db:seed   # wipe fixture tables first (seed is not idempotent)
```

Real GRB data lands via the importer (#20).

## Vanilla Postgres (any non-Supabase host)

Server-side rendering uses no Supabase-specific services (Auth is Phase 2; the browser's Realtime live feed degrades silently when `VITE_SUPABASE_*` is unset), so any Postgres serves the app once the Supabase-provided objects are shimmed in — the same recipe the per-PR migration check runs against a fresh `postgres` container. Against a direct (non-transaction-pooler) URL:

```bash
export DATABASE_URL='<direct connection URL>'
node scripts/prepare-vanilla-pg.mjs   # auth schema/roles shim + realtime publication
bun run db:migrate
SEED_REMOTE=1 bun run db:seed
```

Switching the app between providers is then just repointing the service's `DATABASE_URL`. When doing so, also repoint the `PROD_MIGRATE_DATABASE_URL` secret (see [Apply migrations](#apply-migrations)) — otherwise merges keep migrating the old provider's database and the live one drifts.

## Deploy

Merge to `main` → Railway builds the Dockerfile and deploys. **Migrations must already be applied to the hosted DB** (above) before/with the deploy.

## catalog-sync watchdog

The nightly catalog sync is a separate Railway cron service (`bun run catalog:sync`, 06:00 UTC, `CATALOG_SYNC_REMOTE=1`). Nothing about it is visible from this repo, so every finished attempt writes a `catalog_sync_runs` row — success or failure, with the reason — and that is the only record that the cron still works.

- **`/status/catalog-sync`** serves that freshness signal (last success, its age in seconds, and the newest attempt). Public and uncacheable: it reveals only when the public catalog last synced, which is what lets the probe hold no secret. Like `/healthz` it answers **200 whenever the app is up** and reports database trouble in the body (`"db": "unavailable"`) — an unreadable signal is a thing to alarm on, so the probe must never have to guess whether a non-200 meant that or a sleeping app.
- The **`catalog watchdog`** workflow reads it daily at 08:00 UTC and keeps one `catalog-watchdog` issue in sync — opened while the last success is older than `STALE_AFTER_HOURS` (20: healthy mornings read ~2h, one missed night reads ~26h, so the first failed night alarms), body refreshed each night rather than commented on, closed automatically once a sync lands. Sticky by design: a long upstream outage holds a single open issue instead of one per night, and a lone blip closes itself the next morning.

Triage from the issue body:

- **The newest attempt FAILED with an upstream 5xx** — nothing to do on our side. The sync is transactional and dies during fetch, so the catalog is stale, never half-applied. The issue closes itself when the upstream recovers.
- **The newest attempt SUCCEEDED**, or none is recorded — then no sync has run since. Check the Railway cron service (schedule, crashed deploy, missing `DATABASE_URL`), not the upstream.
- **The freshness signal itself is unreadable** (`db: unavailable`) — usually migration `0009` not yet applied through the [gated migrate-prod action](#apply-migrations), otherwise a database brownout.
- **The workflow run failed red without an issue** — nothing answered at that URL, so freshness is unknown; that is the `prod watchdog`'s beat, not a sync failure.

After a fix, run _Actions → catalog watchdog → Run workflow_ rather than waiting for 08:00 UTC to confirm the stand-down.

The sync reads the [gszabi99 datamine](catalog-sync.md#data-source--licensing) directly. `WT_VEHICLES_API_URL` is retired — delete it from the `catalog-sync` service's variables; it is read by nothing and only misleads the next person triaging a stale catalog.

## If a deploy fails at the healthcheck

The Railway healthcheck must target a path that answers 200 (`healthcheckPath` is `/healthz`; `/` only 307s to `/grb`). Diagnose in this order:

0. **Healthcheck probes `/healthz`** — app liveness + a 2s-bounded DB ping that reports (but does not fail on) database state, so deploys are not hostage to provider brownouts. The scheduled `prod watchdog` workflow separately probes the real landing every 30 min and opens/closes a `watchdog` issue with provider-status context; the nightly cron has its own, see [catalog-sync watchdog](#catalog-sync-watchdog).
1. **Requests hang with no errors anywhere, while lightly-loaded routes still serve:** the pooler is stalling NEW connection establishment (established ones keep working) — a provider brownout, not an app bug. `connect_timeout` now turns these into fast 500s + Sentry events. Check status.supabase.com first; redeploy after it clears.
1. **Hangs, no error (~5 min):** the DB connection can't be established → `DATABASE_URL` is the local/direct host, not the IPv4 pooler.
2. **Fast 5xx ("service unavailable"):** the DB is reachable but a query throws → schema not migrated (`relation "modes" does not exist`), or the pooler password placeholder wasn't filled.
3. **One query-heavy page times out while every other page serves fast:** `DATABASE_URL` is on the transaction pooler (`:6543`) and that page's parallel query burst hit the Supavisor pipelining hang — switch to the session pooler (`:5432`), no code change needed.

Runtime SSR errors aren't logged (TanStack turns a loader throw into a 500), so use the two symptoms above rather than expecting a stack trace.
