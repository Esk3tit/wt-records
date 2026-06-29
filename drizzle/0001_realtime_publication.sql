-- Custom SQL migration file, put your code below! --

-- Expose `records` to Supabase Realtime so the browser can subscribe to the
-- live feed (only verified/current rows leak, via the anon RLS policy).
-- Guarded so it is a no-op where the supabase_realtime publication is absent
-- (e.g. PGlite test databases) AND where `records` is already a member, keeping
-- the migration replayable/idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'records'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.records;
  END IF;
END $$;
