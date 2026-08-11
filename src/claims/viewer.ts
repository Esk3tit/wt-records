import { setResponseHeader } from '@tanstack/react-start/server'
import { db } from '#/db'
import { amendmentViewer } from '#/claims/amendments'
import type { AmendmentViewer } from '#/claims/amendments'
import { getSessionUser, hasAuthCookie } from '#/auth/supabase-server'

/** The viewer a public read is answered for, resolved once per request and
    handed to every avatar-bearing helper — never joined per row. Anonymous
    requests skip the auth round-trip entirely and stay cacheable; a signed-in
    viewer with nothing in flight resolves to null, which is the same answer.

    A response that carries somebody's own unpublished value is theirs alone: a
    shared cache serving it on would hand the site the very image it is holding
    back. */
export async function resolveAmendmentViewer(): Promise<AmendmentViewer | null> {
  if (!hasAuthCookie()) return null
  const user = await getSessionUser()
  if (!user) return null
  const viewer = await amendmentViewer(db, user.id)
  if (viewer) {
    setResponseHeader('Cache-Control', 'private, no-store')
    setResponseHeader('Vary', 'Cookie')
  }
  return viewer
}
