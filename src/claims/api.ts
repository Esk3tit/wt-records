import { createServerFn } from '@tanstack/react-start'
import { db } from '#/db'
import { requireSessionUser } from '#/auth/session'
import { requireModerator } from '#/admin/guard'
import { providerAvatarUrl } from '#/auth/profile'
import { storageFromEnvIfConfigured } from '#/storage/r2'
import { assetUrlIfConfigured } from '#/storage/urls'
import { MAX_AVATAR_BYTES } from '#/storage/image-types'
import {
  approveClaim,
  clearClaimDenial,
  denyClaim,
  listDeniedClaims,
  listPendingClaims,
  requestClaim,
  revokeClaim,
} from '#/claims/claims'
import { removeOwnAvatar, setOwnAvatar, setOwnCountry } from '#/claims/owner'
import {
  nonNegativeInt,
  optionalNote,
  positiveInt,
  requiredReason,
  selectableCountryCode,
} from '#/claims/validate'

const avatarStore = () => storageFromEnvIfConfigured() ?? null

/* ── Public (any signed-in User) ─────────────────────────────── */

export const submitClaimRequest = createServerFn({ method: 'POST' })
  .validator(
    (data: { playerId: number; note?: string; seedAvatar?: boolean }) => ({
      playerId: positiveInt(data.playerId, 'playerId'),
      note: optionalNote(data.note),
      seedAvatar: data.seedAvatar === true,
    }),
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

export const uploadMyAvatar = createServerFn({ method: 'POST' })
  .validator((data: FormData) => data)
  .handler(async ({ data: form }) => {
    const user = await requireSessionUser()
    const playerId = positiveInt(Number(form.get('playerId')), 'playerId')
    const file = form.get('avatar')
    if (!(file instanceof File)) throw new Error('Choose an image to upload')
    // A cheap pre-check on the declared size; the decode is the real gate.
    if (file.size > MAX_AVATAR_BYTES) {
      throw new Error('Keep the image under 5 MB.')
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { avatarKey } = await setOwnAvatar(
      db,
      avatarStore(),
      user.id,
      playerId,
      bytes,
    )
    return { avatarUrl: assetUrlIfConfigured(avatarKey) }
  })

export const removeMyAvatar = createServerFn({ method: 'POST' })
  .validator((data: { playerId: number }) => ({
    playerId: positiveInt(data.playerId, 'playerId'),
  }))
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    await removeOwnAvatar(db, avatarStore(), user.id, data.playerId)
  })

export const setMyCountry = createServerFn({ method: 'POST' })
  .validator((data: { playerId: number; countryCode: string | null }) => ({
    playerId: positiveInt(data.playerId, 'playerId'),
    countryCode: selectableCountryCode(data.countryCode),
  }))
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    await setOwnCountry(db, user.id, data.playerId, data.countryCode)
  })

/* ── Moderator ───────────────────────────────────────────────── */

/* One round trip: the work waiting, and the denials, which are not work. */
export const claimQueue = createServerFn({ method: 'GET' })
  .validator((data?: { deniedOffset?: number }) => ({
    deniedOffset: nonNegativeInt(data?.deniedOffset ?? 0, 'deniedOffset'),
  }))
  .handler(async ({ data }) => {
    await requireModerator()
    const [pending, denied] = await Promise.all([
      listPendingClaims(db),
      listDeniedClaims(db, { offset: data.deniedOffset }),
    ])
    return { pending, denied }
  })

export const approveClaimRequest = createServerFn({ method: 'POST' })
  .validator((data: { claimId: number }) => ({
    claimId: positiveInt(data.claimId, 'claimId'),
  }))
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return approveClaim(db, avatarStore(), userId, data.claimId)
  })

export const denyClaimRequest = createServerFn({ method: 'POST' })
  .validator((data: { claimId: number; reason?: string }) => ({
    claimId: positiveInt(data.claimId, 'claimId'),
    reason: optionalNote(data.reason),
  }))
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return denyClaim(db, userId, data.claimId, data.reason)
  })

export const clearClaimDenialRequest = createServerFn({ method: 'POST' })
  .validator((data: { claimId: number }) => ({
    claimId: positiveInt(data.claimId, 'claimId'),
  }))
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return clearClaimDenial(db, userId, data.claimId)
  })

export const revokePlayerClaim = createServerFn({ method: 'POST' })
  .validator((data: { playerId: number; reason: string }) => ({
    playerId: positiveInt(data.playerId, 'playerId'),
    reason: requiredReason(data.reason),
  }))
  .handler(async ({ data }) => {
    const { userId } = await requireModerator()
    return revokeClaim(db, avatarStore(), userId, data.playerId, data.reason)
  })
