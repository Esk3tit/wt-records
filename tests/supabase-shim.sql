-- Objects a real Supabase project provides that our committed migrations
-- reference (auth.users FKs, the anon RLS role). Applied before drizzle-kit
-- migrate on a bare Postgres so the migrations replay unchanged — shared by the
-- PGlite integration tests and the CI migration check. authenticated and
-- service_role aren't referenced yet; kept for Supabase parity.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
