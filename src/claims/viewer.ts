import { setResponseHeader } from '@tanstack/react-start/server'
import { db } from '#/db'
import { loadAmendmentViewer } from '#/claims/amendments'
import type { AmendmentViewer } from '#/claims/amendments'
import { getSessionUser, hasAuthCookie } from '#/auth/supabase-server'

/** The viewer a public read is answered for, resolved once per request and
    handed to every avatar-bearing helper — never joined per row. Anonymous
    requests skip the auth round-trip entirely and stay cacheable; a signed-in
    viewer with nothing in flight resolves to null, which is the same answer.

    A response that carries somebody's own unpublished value is theirs alone: a
    shared cache serving it on would hand the site the very image it is holding
    back. Every signed-in response is marked private, not just the ones that
    carry something — a header that appeared when a holder uploaded and
    disappeared when a Moderator decided would time the review for them, which
    is the one thing they must not be able to see. */
export async function resolveAmendmentViewer(): Promise<AmendmentViewer | null> {
  if (!hasAuthCookie()) return null
  setResponseHeader('Cache-Control', 'private, no-store')
  setResponseHeader('Vary', 'Cookie')
  const user = await getSessionUser()
  if (!user) return null
  return loadAmendmentViewer(db, user.id)
}
