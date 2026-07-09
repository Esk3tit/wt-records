# Realtime events are signals, not data

The browser's Supabase Realtime subscription (`records` row changes, filtered by mode) deliberately **ignores event payloads**. An event means only "something changed in this mode"; the client reacts with a debounced `router.invalidate()`, and every rendered byte — feed entries, leaderboard rows, vehicle titles — keeps flowing through the SSR/Drizzle loaders. One subscription per tab, mounted at the `$mode` layout, so whatever page is open refetches through the same mechanism.

**Why:** a `records` row carries only FKs (`vehicle_id`, `player_id`) — rendering from the payload would force `anon` read policies on `vehicles`/`players` (or a per-event server call anyway), widening the deliberately-single-policy RLS surface from ADR 0002. Signal-then-refetch also sidesteps every payload-visibility subtlety: a supersede is an INSERT plus an UPDATE that flips the old row out of `anon` sight, and with RLS in play the delivered event set is hard to reason about — but any one visible event triggers a refetch that reconciles everything. At this domain's cadence (a few records per day) the extra round-trip per event is negligible.

**Considered and rejected:** render-from-payload and a hybrid (payload-driven skeleton, refetch fills in) — both trade a wider public read surface and two data paths for latency we don't need.

**Consequence:** reversing this later means adding `anon` policies table-by-table — an auditable widening, per ADR 0002's consequence clause, not a refactor. The future §9.2 aggregate-streaming path (stats-table changes or Broadcast) is unaffected: it slots in as a new channel behind the same signal seam.
