# Catalog sync: source-adapter seam and datamine mappings

The catalog sync (PRD §10.1) is split at a **source-adapter seam**:
`CatalogSource` adapters produce a normalized `CatalogSnapshot` in datamine
vocabulary (identifier, country, vehicle_type, era, per-realism BRs), and a
single engine (`syncCatalog`) owns all mapping and DB writes. The committed
baseline adapter is the public **WT Vehicles API** (GPL-3.0, verified not
AGPL) plus the **gszabi99 datamine locale CSV** for English display names,
which the API does not carry. A second source (a private live+dev-server
datamine repo, evaluation pending on #19) becomes another adapter that
enriches the same engine — mappings are shared because every candidate source
speaks datamine vocabulary.

Decisions fixed here (the §12 "datamine field → class" residual):

- **Type → branch + class:** `light_tank/medium_tank/heavy_tank → light/medium/heavy`,
  `tank_destroyer → spg`, `spaa → spaa`, `fighter → fighter`,
  `assault → attacker`, `bomber → bomber`, both helicopter types → `heli`
  (**air** branch, per PRD §9), all naval types → `naval/other`. Unknown
  types are skipped with a warning — the sync never guesses a class, because
  class drives qualifying thresholds.
- **Mode ↔ BR:** a vehicle gets a `vehicle_br` row only for modes whose
  `branch` matches its own (the same invariant the stats views enforce);
  realistic modes read `realistic_br`, arcade modes `arcade_br`, configured
  per mode id in `modeBrField`. A new `modes` row needs an entry there before
  its BRs sync.
- **Rank = datamine era**, `is_event = event tag present`, premium/squadron
  straight from the source (pack vehicles are premium upstream already).
- **Scope is mode-driven:** vehicles are synced iff some `modes` row plays
  their branch — adding a naval mode auto-extends the catalog, no code
  change.
- **Killstreak/scripted units are not catalog vehicles:** the API's own
  `excludeKillstreak` filter plus "no shop-name locale entry" (nuke drones,
  event-boss units) — both surfaced as summary warnings, never silent.
- **Identity & immutability:** vehicles key on `external_id` (datamine
  identifier). Slugs are public URLs — assigned once on insert
  (name-collision fallback: `-nation`, then a counter, in deterministic
  externalId order) and never rewritten. `is_difficult`,
  `nations.background_url`, and patch metadata are manual overlays the sync
  never touches. Vehicles absent from a snapshot get `is_removed = true`
  (metadata-only, per the removed-vehicles rule), not deleted.
- **Safety:** one transaction per run; a snapshot below 1,000 vehicles
  aborts, and a run that would flag more than max(25, 5% of the catalog)
  removed aborts too (a partial response or mapping drift must not
  mass-remove the catalog); `--dry-run` applies everything and rolls back;
  a real sync against a non-local DB requires `CATALOG_SYNC_REMOTE=1`.

Considered and rejected: putting the type/country mapping inside each adapter
(duplicates rules the moment a second source lands); deleting departed
vehicles (records must outlive catalog churn); auto-creating unknown nations
(a wrong sort/name in production beats a loud warning by nothing); a
`br_source` column on `modes` instead of the `modeBrField` code map (BR-field
choice is source-vocabulary knowledge that belongs with the sync, and a new
mode already needs code-adjacent work — thresholds, BR rows — before going
live; revisit if mode additions become frequent).
