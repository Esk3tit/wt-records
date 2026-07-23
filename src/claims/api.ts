import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import { requireSessionUser } from '#/auth/session'
import { requireModerator } from '#/admin/guard'
import { providerAvatarUrl } from '#/auth/profile'
import { storageFromEnvIfConfigured } from '#/storage/r2'
import {
  approveClaim,
  denyClaim,
  listPendingClaims,
  releaseClaim,
  requestClaim,
  revokeClaim,
} from '#/claims/claims'

const avatarStore = () => storageFromEnvIfConfigured() ?? null

/* ── Public (any signed-in User) ─────────────────────────────── */

export const submitClaimRequest = createServerFn({ method: 'POST' })
  .validator(
    (data: { playerId: number; note?: string; seedAvatar?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    // Derive the seed URL from the trusted session, never the client — a
    // caller must not be able to point the mirror at an arbitrary URL.
    const seedAvatarUrl = data.seedAvatar ? providerAvatarUrl(user) : null
    return requestClaim(db, user.id, data.playerId, {
      note: data.note,
      seedAvatarUrl,
    })
  })

export const releaseMyClaim = createServerFn({ method: 'POST' })
  .validator((data: { playerId: number }) => data)
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    return releaseClaim(db, avatarStore(), user.id, data.playerId)
  })

/* ── Moderator ───────────────────────────────────────────────── */

export const claimQueue = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireModerator()
    return listPendingClaims(db)
  },
)

export const approveClaimRequest = createServerFn({ method: 'POST' })
  .validator((data: { claimId: number }) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return approveClaim(db, avatarStore(), data.claimId)
  })

export const denyClaimRequest = createServerFn({ method: 'POST' })
  .validator((data: { claimId: number }) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return denyClaim(db, data.claimId)
  })

export const revokePlayerClaim = createServerFn({ method: 'POST' })
  .validator((data: { playerId: number }) => data)
  .handler(async ({ data }) => {
    await requireModerator()
    return revokeClaim(db, avatarStore(), data.playerId)
  })
