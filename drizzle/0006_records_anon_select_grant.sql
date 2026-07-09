-- Custom SQL migration file, put your code below! --

-- The anon RLS policy on `records` is not enough by itself: Supabase's default
-- privileges give roles no SELECT on tables created by `postgres`, and without
-- the table privilege Realtime's RLS check silently delivers no events (the
-- subscribe still succeeds). Row exposure stays governed by the
-- records_anon_select_current policy — this grants the privilege, not the rows.
-- Guarded so it is a no-op where the anon role is absent (PGlite test DBs).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON TABLE public.records TO anon;
  END IF;
END $$;
