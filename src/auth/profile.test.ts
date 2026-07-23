import { describe, expect, it } from 'vitest'
import { profileFromUser, providerAvatarUrl } from '#/auth/profile'

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

describe('providerAvatarUrl', () => {
  const identity = (data: Record<string, unknown>) => ({
    identities: [{ identity_data: data }],
  })

  it('reads the provider identity avatar_url, then falls back to picture', () => {
    expect(
      providerAvatarUrl(
        identity({ avatar_url: 'https://cdn.discordapp.com/avatars/1/x.png' }),
      ),
    ).toBe('https://cdn.discordapp.com/avatars/1/x.png')
    expect(
      providerAvatarUrl(
        identity({ picture: 'https://lh3.googleusercontent.com/y' }),
      ),
    ).toBe('https://lh3.googleusercontent.com/y')
  })

  it('ignores user_metadata — a user can rewrite it (SSRF)', () => {
    expect(
      providerAvatarUrl({
        // @ts-expect-error deliberately passing the old, untrusted shape
        user_metadata: { avatar_url: 'https://cdn.discordapp.com/a/1/x.png' },
      }),
    ).toBeNull()
  })

  it('rejects off-host, non-https, and missing pictures', () => {
    expect(
      providerAvatarUrl(identity({ avatar_url: 'https://evil.example.com/x' })),
    ).toBeNull()
    expect(
      providerAvatarUrl(
        identity({ avatar_url: 'http://cdn.discordapp.com/x' }),
      ),
    ).toBeNull()
    expect(providerAvatarUrl(identity({ avatar_url: 'not-a-url' }))).toBeNull()
    expect(providerAvatarUrl({})).toBeNull()
  })
})
