-- Derived stats views: aggregates are computed from `records`, never stored
-- as counters. security_invoker so the deny-by-default RLS applies to
-- whoever queries (SSR uses the service role; anon sees nothing extra).
CREATE VIEW "player_stats" WITH (security_invoker = true) AS
SELECT
  r.mode,
  r.player_id,
  count(*)::int AS records,
  sum(r.kills)::int AS total_kills,
  avg(r.kills)::float8 AS avg_kills
FROM records r
WHERE r.is_current AND r.status = 'verified'
GROUP BY r.mode, r.player_id;
--> statement-breakpoint
CREATE VIEW "leaderboard" WITH (security_invoker = true) AS
SELECT
  ps.mode,
  ps.player_id,
  p.slug,
  p.display_name,
  ps.records,
  ps.total_kills,
  rank() OVER (PARTITION BY ps.mode ORDER BY ps.records DESC)::int AS rank
FROM player_stats ps
JOIN players p ON p.id = ps.player_id;
--> statement-breakpoint
-- Live modes only: staged (coming-soon) modes must not leak into the
-- cross-mode board, mirroring the player-profile gate.
CREATE VIEW "leaderboard_all_modes" WITH (security_invoker = true) AS
SELECT
  ps.player_id,
  p.slug,
  p.display_name,
  sum(ps.records)::int AS records,
  sum(ps.total_kills)::int AS total_kills,
  rank() OVER (ORDER BY sum(ps.records) DESC)::int AS rank
FROM player_stats ps
JOIN modes m ON m.mode = ps.mode AND m.is_live
JOIN players p ON p.id = ps.player_id
GROUP BY ps.player_id, p.slug, p.display_name;
--> statement-breakpoint
-- Completion denominator per mode = every vehicle of the mode's branch;
-- premium/squadron/event/removed are all included (metadata, not filters).
-- Records join through vehicles so an off-branch record (invalid data) can
-- never push covered past the branch-scoped denominator.
CREATE VIEW "global_stats" WITH (security_invoker = true) AS
WITH eligible AS (
  SELECT
    m.mode,
    m.branch,
    (SELECT count(*) FROM vehicles v WHERE v.branch = m.branch)::int AS eligible_vehicles
  FROM modes m
)
SELECT
  e.mode,
  count(r.id)::int AS records,
  count(DISTINCT r.player_id)::int AS holders,
  count(DISTINCT r.vehicle_id)::int AS covered_vehicles,
  e.eligible_vehicles,
  (e.eligible_vehicles - count(DISTINCT r.vehicle_id))::int AS remaining_vehicles,
  CASE WHEN e.eligible_vehicles > 0
    THEN round(count(DISTINCT r.vehicle_id) * 100.0 / e.eligible_vehicles)::int
    ELSE 0
  END AS completion_pct,
  avg(r.kills)::float8 AS avg_kills,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY r.kills::float8) AS median_kills,
  (
    SELECT r2.id FROM records r2
    JOIN vehicles v2 ON v2.id = r2.vehicle_id
    WHERE r2.mode = e.mode AND v2.branch = e.branch
      AND r2.is_current AND r2.status = 'verified'
    ORDER BY r2.verified_at DESC NULLS LAST, r2.id DESC
    LIMIT 1
  ) AS latest_record_id
FROM eligible e
LEFT JOIN (records r JOIN vehicles v ON v.id = r.vehicle_id)
  ON r.mode = e.mode AND v.branch = e.branch
  AND r.is_current AND r.status = 'verified'
GROUP BY e.mode, e.branch, e.eligible_vehicles;
--> statement-breakpoint
-- Every (mode, nation) pair stays present even at zero coverage.
CREATE VIEW "nation_stats" WITH (security_invoker = true) AS
SELECT
  m.mode,
  n.id AS nation_id,
  n.slug,
  n.name,
  n.sort,
  count(DISTINCT v.id)::int AS eligible_vehicles,
  count(DISTINCT r.vehicle_id)::int AS covered_vehicles,
  CASE WHEN count(DISTINCT v.id) > 0
    THEN round(count(DISTINCT r.vehicle_id) * 100.0 / count(DISTINCT v.id))::int
    ELSE 0
  END AS completion_pct,
  avg(r.kills)::float8 AS avg_kills
FROM modes m
CROSS JOIN nations n
LEFT JOIN vehicles v ON v.nation_id = n.id AND v.branch = m.branch
LEFT JOIN records r
  ON r.vehicle_id = v.id AND r.mode = m.mode
  AND r.is_current AND r.status = 'verified'
GROUP BY m.mode, n.id, n.slug, n.name, n.sort;
