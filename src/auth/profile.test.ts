import { describe, expect, it } from 'vitest'
import { profileFromUser } from '#/auth/profile'

describe('profileFromUser', () => {
  it('prefers the Discord global name and provider id', () => {
    expect(
      profileFromUser({
        id: 'u1',
        user_metadata: {
          custom_claims: { global_name: 'Khai' },
          full_name: 'khai#0',
          name: 'khai#0',
          provider_id: '123456789',
        },
        identities: [{ provider: 'discord', id: '123456789' }],
      }),
    ).toEqual({ id: 'u1', handle: 'Khai', discordId: '123456789' })
  })

  it('falls back through full_name, name, then the identity id', () => {
    expect(
      profileFromUser({
        id: 'u2',
        user_metadata: { name: 'khai#0' },
        identities: [{ provider: 'discord', id: '987' }],
      }),
    ).toEqual({ id: 'u2', handle: 'khai#0', discordId: '987' })
  })

  it('survives missing metadata entirely', () => {
    expect(profileFromUser({ id: 'u3' })).toEqual({
      id: 'u3',
      handle: null,
      discordId: null,
    })
  })
})
