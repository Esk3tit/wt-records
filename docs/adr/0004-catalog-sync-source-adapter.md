# Catalog sync: source-adapter seam and datamine mappings

The catalog sync (PRD §10.1) is split at a **source-adapter seam**:
`CatalogSource` adapters produce a normalized `CatalogSnapshot` in datamine
vocabulary (identifier, country, vehicle_type, era, per-realism BRs), and a
single engine (`syncCatalog`) owns all mapping and DB writes. The baseline
adapter reads the **gszabi99 War Thunder datamine** directly over HTTPS — four
files, ~2.6 MB: `char.vromfs.bin_u/config/wpcost.blkx` (economy: rank,
economic ranks, country, `costGold`, `researchType`, `event`),
`char.vromfs.bin_u/config/unittags.blkx` (type tags, `operatorCountry`),
`lang.vromfs.bin_u/lang/units.csv` (English display names) and `/version`
(game version). Vehicle images are the datamine's own
`tex.vromfs.bin_u/{tanks,aircrafts,ships}/<identifier lowercased>.png`.
A second source (a private live+dev-server datamine repo) becomes another
adapter that enriches the same engine — mappings are shared because every
candidate source speaks datamine vocabulary.

**Superseded:** the original baseline was the public **WT Vehicles API**, a
service that clones this same datamine, parses it into SQLite, and serves the
result. It was dropped once that indirection proved to be pure cost: it went
down for days on a corrupt SQLite file while the datamine stayed current, its
published output ran a month stale, and its arcade BRs disagreed with the
datamine on 217 ground vehicles (the datamine value verified unchanged across
both dates, so staleness does not explain it). Its images were byte-identical
to the datamine's. Self-hosting it was considered and rejected for the same
reason: the extractor clones the datamine anyway, so hosting it would add a
service and a database in front of inputs we can read directly, and would
faithfully reproduce the BR defect. The `CatalogSource` seam is retained —
it keeps the engine source-agnostic and adapters testable from fixtures.

Decisions fixed here (the §12 "datamine field → class" residual):

- **Type → branch + class:** `light_tank/medium_tank/heavy_tank → light/medium/heavy`,
  `tank_destroyer → spg`, `spaa → spaa`, `fighter → fighter`,
  `assault → attacker`, `bomber → bomber`, both helicopter types → `heli`
  (**air** branch, per PRD §9), all naval types → `naval/other`.
- **Class comes from a precedence-ordered list of base class tags, not from
  the first tag upstream happens to emit.** 38% of units carry several
  `type_*` tags and the order carries no meaning: `fighter+jet_fighter` leads
  with the coarse tag, `frontline_bomber+bomber` and `interceptor+fighter`
  lead with the fine one. Several tags are not classes at all but capability
  modifiers — `naval_aircraft`, `torpedo`, `hydroplane`, `missile_tank`,
  `aa_fighter`. So the adapter walks *our* precedence list and takes the first
  base class that matches; every unrecognized tag is ignored as a modifier,
  and each run warns once listing what it ignored, so new upstream vocabulary
  surfaces without silently dropping a vehicle. A unit carrying no recognized
  base class tag is still skipped with a warning — the sync never guesses a
  class, because class drives qualifying thresholds.
- **Mode ↔ BR:** a vehicle gets a `vehicle_br` row only for modes whose
  `branch` matches its own (the same invariant the stats views enforce);
  realistic modes read `realistic_br`, arcade modes `arcade_br`, configured
  per mode id in `modeBrField`. A new `modes` row needs an entry there before
  its BRs sync.
- **Rank = datamine era**, `is_event = event tag present`, premium/squadron
  straight from the source (pack vehicles are premium upstream already):
  premium is `costGold` present, squadron is `researchType == "clanVehicle"`.
  Squadron needs no `shop.blkx` tech-tree traversal — the flat field alone
  reproduces the catalog's squadron set exactly.
- **BR = `BATTLE_RATINGS[economicRank…]`**, a 43-entry table from 1.0 to 15.0
  in thirds, indexed by `economicRankArcade` / `Historical` / `Simulation`.
- **Scope is mode-driven:** vehicles are synced iff some `modes` row plays
  their branch — adding a naval mode auto-extends the catalog, no code
  change.
- **Scripted units are not catalog vehicles**, excluded by three independent
  legs: no shop-name locale entry, *or* an identifier ending `_killstreak`,
  *or* `operatorCountry == "country_invisible"` — all surfaced as summary
  warnings, never silent. The legs do not nest, so all three are load-bearing:
  every `_killstreak` unit carries a shop name and full economy data, so the
  locale rule catches none of them; 17 of them are not `country_invisible`;
  and 7 `country_invisible` units are not `_killstreak`. That last group
  (recon drones, UCAVs, an event snowball tank) reached the live catalog as
  ownable vehicles under the previous rules, which is what `country_invisible`
  — an upstream signal rather than a naming convention — now closes.
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
