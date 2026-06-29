# Committed migrations are the source of truth; tests replay them

We generate versioned SQL migrations with `drizzle-kit generate`, commit them, and apply them with `drizzle-kit migrate` (against per-PR Supabase branches in CI and against production). The PGlite integration tests apply those **same committed migration files** (`drizzle-orm/pglite/migrator`) to a fresh in-memory database per test file, rather than regenerating the schema from `schema.ts`.

**Why:** §16.3 makes "a bad migration can't merge" a required CI check, which only has meaning if reviewable migration files exist. Replaying the committed SQL in the fast test suite means the tests exercise the exact DDL we ship — catching migration drift locally instead of only in the Supabase-branch check.

**Considered and rejected:** `drizzle-kit push` everywhere (no migration history for the required check to validate) and generating the schema from `schema.ts` inside tests via `drizzle-kit/api` (faster setup, but tests would pass against a parallel reality the shipped migrations don't match). The maintainer-recommended `drizzle-kit/api` path also avoids the buggy `pushSchema` export, but we still prefer replaying committed files for fidelity.
