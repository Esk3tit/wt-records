# Catalog sync

Syncs the vehicle catalog from the WT Vehicles API into `vehicles`,
`vehicle_br`, `nations`, and the current `patches` row. Idempotent and
transactional — re-run it as often as you like; a failed run changes nothing.

```bash
bun run catalog:sync --dry-run   # fetch + full apply, then roll back; prints the summary
bun run catalog:sync             # the real thing, against DATABASE_URL
```

## What a run does

1. Fetches every vehicle (hidden/event/premium included, killstreak units
   excluded) from the API, English display names from the datamine locale
   CSV, and the current game version.
2. Upserts the current patch (`2.57.0.8` → `patches.version = '2.57'`), so
   record entry never blocks on a missing patch.
3. Upserts `nations` (canonical in-game order) and `vehicles` keyed by
   `external_id`, and per-mode `vehicle_br` rows (mode ↔ vehicle branch must
   match; realistic modes read realistic BR, arcade modes arcade BR).
4. Flags vehicles that left the catalog `is_removed = true` (they stay
   visible everywhere — metadata, not a filter) and restores them if they
   return.

Manual overlays are never written by the sync: `vehicles.is_difficult`,
vehicle `slug`s (public URLs — assigned once, on first insert),
`nations.background_url`, and `patches.name` / `released_at`.

Vehicles whose branch no mode plays (naval, today) are skipped and counted in
the summary; inserting a naval mode into `modes` is all it takes for the next
run to pick them up.

Two guards protect against a bad upstream response: a snapshot under 1,000
vehicles aborts before writing, and a run that would flag more than
max(25, 5% of the catalog) vehicles as removed aborts and rolls back —
mapping drift (a renamed type vocabulary, a new country) must not mass-remove
live vehicles from an unattended cron.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — (required) | Target Postgres |
| `CATALOG_SYNC_REMOTE` | unset | A real (non-dry) sync against a non-local DB refuses to run unless this is `1`. Slugs are first-run-wins, so accidental remote syncs are irreversible; `Dockerfile.sync` sets it for the cron service. |
| `WT_VEHICLES_API_URL` | `https://wtvehiclesapi.duckdns.org/api` | API base — point at the self-hosted instance to switch |
| `WT_UNITS_CSV_URL` | gszabi99 `units.csv` on raw.githubusercontent.com | English display names |

## Scheduling (Railway cron)

Patches ship every ~2 months but BRs and event vehicles change between them,
so run daily. Create a second Railway service on this repo:

- **Dockerfile path:** `Dockerfile.sync` (a short-lived Bun process — no
  server; it syncs and exits)
- **Cron schedule:** `0 6 * * *`
- **Variables:** `DATABASE_URL` (same reference the web service uses)

## Data source & licensing

- **API:** [WT Vehicles API](https://wtvehiclesapi.duckdns.org/docs)
  ([Sgambe33/WarThunder-Vehicles-API](https://github.com/Sgambe33/WarThunder-Vehicles-API)),
  built on the [gszabi99/War-Thunder-Datamine](https://github.com/gszabi99/War-Thunder-Datamine).
  License verified **GPL-3.0** (GitHub license detection, 2026-07-06) — not
  AGPL, so self-hosting (no distribution) triggers no copyleft obligations on
  our side. Keep the upstream LICENSE and repo attribution intact in any
  fork/self-hosted deployment, and credit both projects anywhere the catalog
  data is described.
- **Self-hosting** (PRD §10.1, ready-for-human): fork/deploy the upstream
  repo as another Railway service, then set `WT_VEHICLES_API_URL` on the cron
  service. Until then the public instance is the committed baseline — the
  sync paces its requests (sequential pages, 250 ms apart, identifying
  User-Agent) to respect it.
- **Second source under evaluation:** a private repo with live + dev-server
  datamine (see #19). It would slot in as another `CatalogSource`
  implementation (`src/catalog/source.ts`) enriching this one — freshness /
  patch-day updates — not replacing it.

## Production rollout order

The dev/staging seed fixture occupies real slugs (`m4a1`, `wirbelwind`, …).
Before the real GRB import (#20): truncate the fixture (`resetFixture`),
run `catalog:sync`, then run the importer against the synced catalog.
Running the sync on a seeded DB is safe — fixture vehicles just get flagged
removed and the real ones take nation-suffixed slugs — but the clean order
above gives the real catalog the canonical slugs.
