import { join } from 'node:path'

/** Written by the `setup` project, git-ignored, never committed — a stored
    session goes stale the moment Supabase rotates its signing key. */
export const AUTH_DIR = join(import.meta.dirname, '..', '.auth')

export const STATE = {
  admin: join(AUTH_DIR, 'admin.json'),
  user: join(AUTH_DIR, 'user.json'),
  anon: join(AUTH_DIR, 'anon.json'),
} as const
