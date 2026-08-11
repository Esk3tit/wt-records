import { describe, expect, it } from 'vitest'
import { effectiveAvatarKey, effectiveCountry } from '#/db/queries'

/* The shadow's whole predicate, at the seam every avatar surface funnels
   through: the owner is served what they proposed, and every other class of
   viewer — anonymous, another signed-in User, a Moderator browsing the public
   site, and any call site that forgot to ask — is served the reviewed value. */

const OWNER = '00000000-0000-4000-8000-0000000000aa'
const OTHER = '00000000-0000-4000-8000-0000000000bb'

const claimed = { userId: OWNER, avatarKey: 'avatars/1/approved.webp' }
const ownerViewing = {
  userId: OWNER,
  pendingAvatarKey: 'avatars/1/pending.webp',
}

describe('effectiveAvatarKey', () => {
  it('serves the owner their own pending value', () => {
    expect(effectiveAvatarKey(claimed, ownerViewing)).toBe(
      'avatars/1/pending.webp',
    )
  })

  it('serves the approved value to everyone else', () => {
    // Anonymous, a signed-in non-owner, and a Moderator browsing publicly are
    // the same viewer here — being signed in is not a side channel.
    expect(effectiveAvatarKey(claimed, null)).toBe('avatars/1/approved.webp')
    expect(
      effectiveAvatarKey(claimed, {
        userId: OTHER,
        pendingAvatarKey: 'avatars/2/theirs.webp',
      }),
    ).toBe('avatars/1/approved.webp')
  })

  it('serves the approved value when the viewer is omitted', () => {
    // The failure direction is safe by construction: forgetting the shadow
    // publishes what a Moderator accepted, never what nobody has seen.
    expect(effectiveAvatarKey(claimed)).toBe('avatars/1/approved.webp')
  })

  it('serves the owner their pending value over no approved one at all', () => {
    expect(
      effectiveAvatarKey({ userId: OWNER, avatarKey: null }, ownerViewing),
    ).toBe('avatars/1/pending.webp')
    expect(effectiveAvatarKey({ userId: OWNER, avatarKey: null })).toBeNull()
  })

  it('shows an accountless Player the Medallion, whoever is looking', () => {
    // An Avatar belongs to a Claim: a stale key on an unclaimed row publishes
    // nothing, and no viewer overrides that.
    const accountless = { userId: null, avatarKey: 'avatars/1/stale.webp' }
    expect(effectiveAvatarKey(accountless)).toBeNull()
    expect(effectiveAvatarKey(accountless, ownerViewing)).toBeNull()
  })
})

describe('effectiveCountry', () => {
  it('carries a Country only for a claimed Player', () => {
    expect(effectiveCountry({ userId: OWNER, countryCode: 'JP' })).toBe('JP')
    expect(effectiveCountry({ userId: null, countryCode: 'JP' })).toBeNull()
  })
})
