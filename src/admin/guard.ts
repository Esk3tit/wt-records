import { getSessionUser } from '#/auth/supabase-server'
import { getProfileRole } from '#/auth/profile'
import { db } from '#/db'

/* THE moderator gate (ADR 0008): validate the JWT, then read profiles.role
   through the service-role connection. There is no RLS backstop — every
   admin server function must call requireModerator() before touching data. */

export type AdminGate =
  | { state: 'signed-out' }
  | { state: 'not-moderator'; handle: string | null }
  | {
      state: 'moderator'
      userId: string
      handle: string | null
      role: 'moderator' | 'admin'
    }

export async function adminGate(): Promise<AdminGate> {
  const user = await getSessionUser()
  if (!user) return { state: 'signed-out' }
  const profile = await getProfileRole(db, user.id)
  if (!profile || profile.role === 'viewer') {
    return { state: 'not-moderator', handle: profile?.handle ?? null }
  }
  return {
    state: 'moderator',
    userId: user.id,
    handle: profile.handle,
    role: profile.role,
  }
}

export async function requireModerator(): Promise<{
  userId: string
  role: 'moderator' | 'admin'
}> {
  const gate = await adminGate()
  if (gate.state !== 'moderator') {
    throw new Error('Moderator access required')
  }
  return { userId: gate.userId, role: gate.role }
}
