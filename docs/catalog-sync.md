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

## Image mirroring

After a real (non-dry) sync commits, vehicle images are mirrored from the
upstream host into the R2 assets bucket so the site never hotlinks third-party
hosting. Best-effort and outside the sync transaction: a mirror failure is a
warning in the summary, never a failed sync.

- `vehicles.image_url` keeps the upstream source URL; `vehicles.image_key`
  holds the mirrored object's key. Read paths build serving URLs with
  `assetUrl(key)` from `#/storage/urls` (needs only `R2_ASSETS_BASE_URL`, never
  bucket credentials) — no UI consumes it yet; that lands with the record-sheet
  work.
- Keys embed a hash of the source URL (`vehicles/<external_id>-<hash8>.<ext>`),
  which makes runs idempotent: an unchanged URL is skipped, a changed URL
  re-mirrors under a new key and deletes the stale object; an upstream image
  that disappears gets its mirror cleaned up. Changing the key format itself
  re-mirrors the whole catalog on the next run — deliberate, but pair it with
  `--mirror-limit`.
- Mirroring is skipped with a note when the `R2_*` vars are absent, so local
  dev without R2 credentials still syncs.
- `--mirror-limit=N` caps a run's uploads — use it to spread the initial
  ~2,700-image backfill over a few daily runs instead of one burst against the
  upstream API.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — (required) | Target Postgres |
| `CATALOG_SYNC_REMOTE` | unset | A real (non-dry) sync against a non-local DB refuses to run unless this is `1`. Slugs are first-run-wins, so accidental remote syncs are irreversible; `Dockerfile.sync` sets it for the cron service. |
| `WT_VEHICLES_API_URL` | `https://wtvehiclesapi.duckdns.org/api` | API base — point at the self-hosted instance to switch |
| `WT_UNITS_CSV_URL` | gszabi99 `units.csv` on raw.githubusercontent.com | English display names |
| `R2_*` | unset (mirroring skipped) | Assets-bucket credentials for image mirroring — see `.env.example` |

## Scheduling (Railway cron)

Patches ship every ~2 months but BRs and event vehicles change between them,
so run daily. Create a second Railway service on this repo:

- **Dockerfile path:** `Dockerfile.sync` (a short-lived Bun process — no
  server; it syncs and exits)
- **Cron schedule:** `0 6 * * *`
- **Variables:** `DATABASE_URL` (same reference the web service uses) and the
  `R2_*` vars (same values as the web service) so the cron mirrors images

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
