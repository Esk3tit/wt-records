# Deploy runbook (Railway)

The SSR app deploys to Railway from `main` via the [`Dockerfile`](../Dockerfile). Every page renders through the database (the root + home route loaders query on every request), so the DB must be **reachable, migrated, and — for a non-empty site — seeded** before a deploy can pass its healthcheck.

## Required Railway variables (production service)

- **`DATABASE_URL`** — the Supabase **Transaction pooler** (Supavisor) string: host `…pooler.supabase.com`, port **6543**, user `postgres.<ref>`. The client sets `prepare: false` for it.
  - Do **not** use the **direct** host (`db.<ref>.supabase.co:5432`) — it's IPv6-only and Railway egresses over IPv4, so the connection hangs.
  - Do **not** paste the local `postgresql://…@127.0.0.1:54322/…` value.
- `SUPABASE_URL`; plus `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` once Realtime/Auth land (Phase 2).
- `SENTRY_DSN` and the `VITE_*` observability keys.

## Apply migrations (manual, until CI automates it — #14)

The app never self-migrates. After any schema change, apply the committed migrations to the hosted DB **through the Session pooler or Direct connection** — *not* the transaction pooler, because `drizzle-kit` uses prepared statements the transaction pooler rejects:

```bash
DATABASE_URL='<session-pooler (port 5432) or direct URL>' bun run db:migrate
```

## Seed (optional)

```bash
DATABASE_URL='<session-pooler or direct URL>' bun run db:seed   # deterministic dev fixture — FAKE data
```

The dev fixture is for local/staging only. Real GRB data lands via the importer (#20). An empty-but-migrated DB still passes the healthcheck (the home renders), but the `/$mode` pages 404 until the `modes` rows exist.

## Deploy

Merge to `main` → Railway builds the Dockerfile and deploys. **Migrations must already be applied to the hosted DB** (above) before/with the deploy.

## If a deploy fails at the healthcheck

Railway healthchecks `GET /`, which hits the DB. Diagnose in this order:

1. **Hangs, no error (~5 min):** the DB connection can't be established → `DATABASE_URL` is the local/direct host, not the IPv4 pooler.
2. **Fast 5xx ("service unavailable"):** the DB is reachable but a query throws → schema not migrated (`relation "modes" does not exist`), or the pooler password placeholder wasn't filled.

Runtime SSR errors aren't logged (TanStack turns a loader throw into a 500), so use the two symptoms above rather than expecting a stack trace.
