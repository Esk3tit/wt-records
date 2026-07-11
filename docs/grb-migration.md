# GRB migration importer

Imports the community's original GRB records spreadsheet — ~1,100 verified
records across 10 nation tabs — into `players`, `records`, and `record_proof`,
replacing the dev/design seed fixture. Mode-parameterized (`--mode=grb` is the
default and the only config so far); the sheet's proof links resolve through
imgur's web endpoint per ADR 0007.

The pipeline is three staged commands. Each stage writes committed artifacts
under `data/migration/<mode>/` — the permanent provenance record — and later
stages read only those artifacts, never the sheet or imgur again.

```bash
bun run import:extract   # sheet + imgur → snapshot.json, findings.md
bun run import:resolve   # + catalog/overrides → resolution.json, review.md
bun run import:load      # resolution → the database (transactional)
```

## Extract

Reads every nation tab through the Google Sheets API (`GOOGLE_SHEETS_API_KEY`;
the proof URLs live behind cell hyperlinks, which CSV/xlsx exports don't carry
for this sheet) and resolves every imgur album — media list plus exact upload
timestamps — via the web-client endpoint. Imgur fetches are throttled
(`--imgur-throttle-ms`, default 1000) behind an on-disk resume cache in
`data/migration/<mode>/cache/imgur/` (gitignored), so a killed run resumes
where it stopped.

Extraction cross-checks itself against the sheet's own aggregates (the
Leaderboard record total and the DataSheet player list) and exits non-zero on
any structural surprise. `findings.md` records corpus stats: rows per tab,
patch histogram, proof hosts, dead albums, proof gaps.

## Resolve

Matches every row against the synced catalog (run `catalog:sync` first) and
adjudicates everything a human needs to see before data lands:

- **Vehicles**: name+nation matching over the catalog's search terms (symbol
  prefixes and roman/arabic numerals normalize away). Only exact or clearly
  ahead fuzzy matches auto-resolve; everything else lands in `review.md` with
  candidates.
- **Patches**: the sheet's version strings must exist in `patches.json` (the
  ~38-entry historical backfill: version, name, release date).
- **Dates**: each row's earliest proof upload becomes `submittedAt` and
  `verifiedAt` (the record's official date — ADR 0007). An upload that
  predates its claimed patch's release is a contradiction and blocks the row.
- **Duplicates**: two rows resolving to one vehicle keep both records; the
  higher kill count (tie: later upload) is `is_current`, ties block.
- **Players**: one player per distinct sheet name; slugs collide into `-2`
  suffixes, unslugifiable names fall back to `player`.

Anything blocked is adjudicated in `overrides.json` (vehicle mappings, patch
corrections, accepted date contradictions, duplicate winners, player slugs) —
committed, so every human decision survives. Load refuses while any row is
unresolved.

Rows whose proof is dead or video-only degrade instead of blocking:
`submittedAt` = extraction date, `verifiedAt` = null (rendered as "migrated"),
and the row is listed under proof gaps for moderator follow-up.

## Load

All-or-nothing. First mirrors every live imgur image to the R2 proofs bucket
(`migration/<mode>/<imageId>.<ext>`, throttled, resumable via a gitignored
manifest; any failure aborts before the database is touched). Then, in one
transaction:

1. Rules-sync: upserts the four canonical modes, this mode's
   `difficult_min_kills`, `mode_min_kills`, and flags the Rules tab's
   difficult vehicles (`rules.json`, human-transcribed).
2. Patches backfill: upserts `patches.json` (fills `name`/`released_at` that
   catalog:sync never writes).
3. Wipes players/records/proofs wholesale — valid only pre-launch, so it
   refuses if any user-submitted record exists (`submitted_by_id` set).
4. Inserts players (accountless, claimable later) with `migration`-source
   aliases, records (`status=verified`, `imported_from='sheet'`,
   `submitted_by_id=null`), and proofs (mirrored `storage_path` +
   `original_url`; videos stay external by design). Proof `kind` is an
   approximation — every image behind a Screenshot column is `scoreboard`,
   behind Screenshot 2 `end_game` — because historical albums can't be
   classified per image. The vehicle page serves the mirrored copy and falls
   back to the original URL.

`--dry-run` applies everything and rolls back (mirroring skipped). Guards
match the house pattern: a non-local `DATABASE_URL` refuses without
`IMPORT_LOAD_REMOTE=1`, and a remote load without R2 credentials refuses
outright. The pre-launch guard (no user-submitted records, no account-claimed
players) runs before the mirror phase and again inside the transaction; R2
uploads themselves can't be transactional, but every mirror side effect is
confined to the `migration/<mode>/` prefix plus the gitignored manifest — a
load that ends up permanently refused is cleaned by deleting that prefix.

## Production rollout

Per docs/catalog-sync.md, so the real catalog gets canonical slugs:

```bash
bun run import:reset     # truncate fixture + seed canonical modes (IMPORT_RESET_REMOTE=1)
bun run catalog:sync     # real catalog, canonical slugs (CATALOG_SYNC_REMOTE=1)
bun run import:load      # the migration (IMPORT_LOAD_REMOTE=1, R2_* set)
```

`import:reset` exists because `resetFixture` truncates `modes`, and
catalog:sync skips every vehicle whose branch no mode plays — the reseed keeps
the rollout order runnable. Load runs locally against the prod session pooler;
importer code never ships in the app image.

## Artifacts

| File | Written by | Purpose |
| --- | --- | --- |
| `snapshot.json` | Extract | Verbatim rows + resolved imgur posts |
| `findings.md` | Extract | Corpus stats, cross-checks, problems |
| `patches.json` | hand-authored | Historical patch backfill (version/name/date) |
| `rules.json` | hand-authored | Rules-tab thresholds + difficult vehicles |
| `overrides.json` | hand-authored | Every human adjudication |
| `resolution.json` | Resolve | Load's only input: fully-resolved rows |
| `review.md` | Resolve | Everything a human should eyeball |
| `cache/` | Extract/Load | Resume caches (gitignored) |
