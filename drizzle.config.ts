import process from 'node:process'
import { defineConfig } from 'drizzle-kit'

// schemaFilter: only manage `public` — never touch Supabase's `auth` schema
// (we reference auth.users via drizzle-orm/supabase, which is marked existing).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
