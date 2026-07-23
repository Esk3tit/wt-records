import type { User } from '@supabase/supabase-js'
import { getSessionUser } from '#/auth/supabase-server'

/** Any signed-in User (viewer or above), for public actions like claiming a
    Player. Distinct from requireModerator, which additionally gates on role. */
export async function requireSessionUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) throw new Error('Sign-in required')
  return user
}
