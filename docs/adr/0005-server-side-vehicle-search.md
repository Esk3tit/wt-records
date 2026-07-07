# Vehicle search: server-side in Postgres, sync-generated search terms

The three search surfaces (Quick search, Browse, Lookup — see CONTEXT.md
§Search) all match and filter **server-side in Postgres**; the client owns
nothing but the URL. Filter state lives in search params, loaders re-run the
query, pages render fully filtered — every view is a shareable, crawlable URL,
and search stays on the app's one architecture (`loader → server fn →
queries.ts → SQL`) instead of growing a second, client-resident one.

Matching is two-tiered over a `vehicle_search_terms` table (vehicle_id, term)
written by the catalog sync:

- **Search terms** are produced by one TS normalizer: NFKD → strip combining
  marks → lowercase → drop everything outside `[a-z0-9]` (tree-marker glyphs,
  punctuation, spaces all collapse, so `t34`, `t-34`, `t 34` are the same
  key), plus deterministic numeral variants — any name token that is a valid
  roman numeral with value 1–30 is also emitted in its arabic form and vice
  versa (`Tiger II` ⇄ `tiger 2`; the 1–30 cap excludes ambiguous tokens like
  the `C` in `Kfir C.7` or `109`). The same function normalizes incoming
  query terms, so there is exactly one matching implementation. Expansion
  errors are additive only (an extra match, ranked low), never a miss, and
  the generator is snapshot-tested against the full synced catalog. Curated
  nicknames later become extra rows in the same table — data, not code.
- **Tier 1 (exact):** normalized query is a contiguous substring of a term;
  ranked by match position, then term length, then name. Accepted weakness:
  non-adjacent words don't match (`tiger h` won't find `Tiger II (H)`).
- **Tier 2 (typos):** `pg_trgm` similarity fallback, always ranked below
  tier-1 hits. The migration is `CREATE EXTENSION IF NOT EXISTS pg_trgm`
  with no schema pin — Supabase installs extensions into its `extensions`
  schema, vanilla Postgres (Railway, PGlite tests) into `public`; both are on
  the search path.

Considered and rejected: **client-side in-memory filtering** (at ~1.2k rows
per mode it works, but it forces the normalizer to exist twice — TS for the
browser and SQL for quick search — ships the catalog to every visitor, and
introduces a one-page-only architecture; the cost is ~100–300ms per filter
change, mitigated by intent-preloading); **hosted search engines**
(Algolia-class free tiers meter ~10k searches/month and a typeahead spends
one per keystroke — a paid trigger wire under the hero input, plus a second
data system needing its own sync job — for 2,684 short strings);
**embeddings/semantic search** (nobody queries vehicle names by meaning; the
filters are the semantic layer); **token-AND matching on space-preserved
names** (fixes non-adjacent words but reintroduces the `bf109` vs `bf 109`
split — the collapsed-substring rule matches how people actually type
designations).
