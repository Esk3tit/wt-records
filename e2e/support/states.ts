import { join } from 'node:path'

/** Written by the `setup` project, git-ignored, never committed — a stored
    session goes stale the moment Supabase rotates its signing key. */
export const AUTH_DIR = join(import.meta.dirname, '..', '.auth')

/** Named for the role each state carries, not for where it can go: the
    moderator state is what reaches /admin, but `admin` is a distinct role. */
export const STATE = {
  moderator: join(AUTH_DIR, 'moderator.json'),
  viewer: join(AUTH_DIR, 'viewer.json'),
  anon: join(AUTH_DIR, 'anon.json'),
} as const
