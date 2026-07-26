-- Custom SQL migration file, put your code below! --

-- Seven scripted units (recon drones, UCAVs, an event snowball tank) that reached
-- the catalog before the source read operatorCountry. The never-delete invariant
-- exists so records outlive catalog churn, so verify none has acquired one rather
-- than assume it. No-op on a fresh database.
DO $$
DECLARE
  scripted text[] := ARRAY[
    'uav_quadcopter',
    'ucav_mq_1_predator',
    'ucav_orion',
    'ucav_recon_micro',
    'ucav_recon_micro_flir',
    'ucav_wing_loong_i',
    'us_m8_scott_snowball'
  ];
  doomed integer[];
  offenders text;
BEGIN
  SELECT array_agg(id) INTO doomed
  FROM vehicles WHERE external_id = ANY(scripted);

  IF doomed IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(v.external_id || ' (' || c.n || ')', ', ' ORDER BY v.external_id)
  INTO offenders
  FROM vehicles v
  JOIN LATERAL (
    SELECT count(*) AS n FROM records r WHERE r.vehicle_id = v.id
  ) c ON c.n > 0
  WHERE v.id = ANY(doomed);

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to delete scripted units that now hold records: %', offenders;
  END IF;

  DELETE FROM vehicle_search_terms WHERE vehicle_id = ANY(doomed);
  DELETE FROM vehicle_br WHERE vehicle_id = ANY(doomed);
  DELETE FROM vehicles WHERE id = ANY(doomed);
END $$;
