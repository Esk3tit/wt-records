-- Custom SQL migration file, put your code below! --

-- Realtime needs the SELECT privilege on top of the anon RLS policy — without
-- it, WALRUS silently delivers no events while the subscribe still succeeds.
-- Column-scoped to (id, mode): enough for the signal-only subscription, and it
-- keeps the anon key's Data API surface closed (no verifier/submitter reads).
-- Guarded so it is a no-op where the anon role is absent (vanilla Postgres).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT (id, mode) ON public.records TO anon;
  END IF;
END $$;
