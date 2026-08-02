# Catalog sync

Syncs the vehicle catalog from the gszabi99 War Thunder datamine into
`vehicles`, `vehicle_br`, `nations`, and the current `patches` row. Idempotent
and transactional — re-run it as often as you like; a failed run changes
nothing.

```bash
bun run catalog:sync --dry-run   # fetch + full apply, then roll back; prints the summary
bun run catalog:sync             # the real thing, against DATABASE_URL
```

## What a run does

1. Resolves `master` to a commit and reads everything from that one revision —
   data files *and* portraits — so a push landing mid-run can't yield a
   `units.csv` that doesn't cover its `wpcost`, and a recorded portrait URL
   always re-fetches the exact bytes mirrored under it.
   Fetches four datamine files over HTTPS (~2.6 MB gzipped, no clone):
   `wpcost.blkx` (economy — rank, economic ranks, country, `costGold`,
   `researchType`, `event`), `unittags.blkx` (class tags, `operatorCountry`),
   `units.csv` (English display names) and `/version`. Hidden, event and
   premium vehicles are all included; scripted units are not (below).
   BRs are computed from the economic ranks — 1.0 upward in thirds.
   Portraits come from the Git Trees API rather than a guessed path: root →
   `tex.vromfs.bin_u` → one tree per branch, five responses and ~949 KB, which
   yields each file's real path *and* its blob SHA. A vehicle upstream ships no
   artwork for gets no portrait URL at all instead of one that 404s (34 today,
   mostly `nt_*` units), counted in a summary warning.
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

**Scripted units are not catalog vehicles** and are excluded by three
independent legs — no shop-name locale entry, *or* an identifier ending
`_killstreak`, *or* `operatorCountry == "country_invisible"`. All three are
load-bearing (every `_killstreak` unit carries a shop name and full economy
data, and 7 `country_invisible` units are not `_killstreak`), and each drop is
counted in a summary warning rather than being silent.

**Class comes from a precedence list of base class tags**, not from the first
`type_*` tag upstream emits: 38% of units carry several and their order carries
no meaning. Tags outside that list are capability modifiers (`naval_aircraft`,
`torpedo`, `missile_tank`…); a run warns once listing the ones it ignored, so
new upstream vocabulary surfaces. A unit with no recognized base class tag is
skipped with a warning — the sync never guesses a class.

Three guards protect against a bad upstream response: a snapshot under 1,000
vehicles aborts before writing; a run that would flag more than
max(25, 5% of the catalog) vehicles as removed aborts and rolls back —
mapping drift (a renamed type vocabulary, a new country) must not mass-remove
live vehicles from an unattended cron; and a branch with more than
max(50, 10%) artless vehicles aborts the snapshot, so a renamed or moved image
folder upstream reads as the restructure it is rather than as artwork that
vanished. That last one is sized against 71 samples over 19 months, in which
the worst branch ran 26 artless of 1,166 (2.2%). A tree that comes back
truncated, or a folder under 100 entries, aborts on the same reasoning.

## Portrait mirroring

After a real (non-dry) sync commits, vehicle Portraits are mirrored from the
upstream host into the R2 assets bucket so the site never hotlinks third-party
hosting. Best-effort and outside the sync transaction: a mirror failure is a
warning in the summary, never a failed sync.

- `vehicles.portrait_url` keeps the upstream source URL and
  `vehicles.portrait_content_id` the blob SHA of those bytes — both what
  upstream currently offers; `vehicles.portrait_key` holds the mirrored
  object's key, what we actually hold. Read paths build serving URLs with
  `assetUrl(key)` from `#/storage/urls` (needs only `R2_ASSETS_BASE_URL`, never
  bucket credentials).
- Keys are content-addressed (`vehicles/<external_id>-<blobsha8>.<ext>`), which
  makes runs idempotent and replaced artwork detectable: unchanged content is
  skipped even though the pinned URL changes every night, and changed content
  mirrors under a *new* key and deletes the superseded object. The new key
  matters as much as the detection — overwriting one key in place would leave
  every cache serving the old artwork. Changing the key format re-mirrors the
  whole catalog on the next run; that costs ~2,650 images and 246 MB, measured
  at roughly two minutes.
- A Portrait upstream stops publishing is **kept**, not deleted: a null
  `portrait_url` beside a live `portrait_key` is a resting state, not an
  orphan. The registry does not lose imagery it already holds, and a bad
  upstream read can then only withhold artwork, never destroy it.
- Mirroring is skipped with a note when the `R2_*` vars are absent, so local
  dev without R2 credentials still syncs.
- `--mirror-limit=N` caps a run's uploads. Steady state needs ~1 per day, and a
  full re-mirror finishes in one run, so this is a manual tool rather than
  standing config.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — (required) | Target Postgres |
| `CATALOG_SYNC_REMOTE` | unset | A real (non-dry) sync against a non-local DB refuses to run unless this is `1`. Slugs are first-run-wins, so accidental remote syncs are irreversible; `Dockerfile.sync` sets it for the cron service. |
| `CATALOG_GITHUB_TOKEN` | unset (anonymous, and the run warns) | Read-only GitHub token. Anonymous reads get 60 requests/hour keyed on the *IP*, which on shared hosting is spent by strangers — authenticating raises it to the 5,000/hour that belongs to the token's *account*. Needs only public-repository read; the sync sends it only to `api.github.com` and `raw.githubusercontent.com` |
| `WT_UNITS_CSV_URL` | gszabi99 `units.csv` on the pinned revision | English display names. Setting it opts that one file out of revision pinning, so the run warns — a shop name the override lacks makes an ownable unit look scripted |
| `R2_*` | unset (mirroring skipped) | Assets-bucket credentials for portrait mirroring — see `.env.example` |

## Scheduling (Railway cron)

Patches ship every ~2 months but BRs and event vehicles change between them,
so run daily. Create a second Railway service on this repo:

- **Dockerfile path:** `Dockerfile.sync` (a short-lived Bun process — no
  server; it syncs and exits)
- **Cron schedule:** `0 6 * * *`
- **Variables:** `DATABASE_URL` (same reference the web service uses), the
  `R2_*` vars (same values as the web service) so the cron mirrors images, and
  `CATALOG_GITHUB_TOKEN`

The token is not optional in practice: a cron host's egress IP is shared, so
the anonymous budget can already be spent by other tenants before the run
starts — that is how the 2026-08-01 run died, on its very first request.
`docs/deploy.md` covers which kind to mint and how each way of getting it
wrong behaves.

## Data source & licensing

- **Datamine:** [gszabi99/War-Thunder-Datamine](https://github.com/gszabi99/War-Thunder-Datamine),
  read directly over `raw.githubusercontent.com` with an identifying
  User-Agent. Credit the project anywhere the catalog data is described.
- **Superseded:** the catalog used to come from the WT Vehicles API, a service
  that clones this same datamine and serves it from SQLite. It was dropped
  once that indirection proved to be pure cost — days of downtime on a corrupt
  SQLite file while the datamine stayed current, output a month stale, and
  arcade BRs wrong on 217 ground vehicles. Self-hosting it was rejected for the
  same reason: its extractor clones the datamine anyway. See ADR 0004.
- **Second source under evaluation:** a private repo with live + dev-server
  datamine (see #19). It would slot in as another `CatalogSource`
  implementation (`src/catalog/source.ts`) enriching this one — freshness /
  patch-day updates — not replacing it.

## Production rollout order

The dev/staging seed fixture occupies real slugs (`m4a1`, `wirbelwind`, …).
Before the real GRB import: `bun run import:reset` (truncates the fixture and
re-seeds the canonical modes — the sync needs `modes` populated to know which
branches to fill BRs for), then `catalog:sync`, then `import:load` against the
synced catalog (see docs/grb-migration.md). Running the sync on a seeded DB is
safe — fixture vehicles just get flagged removed and the real ones take
nation-suffixed slugs — but the clean order above gives the real catalog the
canonical slugs.
