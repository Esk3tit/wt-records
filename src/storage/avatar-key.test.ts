import { describe, expect, it } from 'vitest'
import { playerAvatarKey } from '#/storage/avatar-key'

const bytes = new Uint8Array([1, 2, 3, 4])

describe('playerAvatarKey', () => {
  it('keys under the player and hashes the bytes with the mapped extension', () => {
    const key = playerAvatarKey(42, bytes, 'image/png')
    expect(key).toMatch(/^avatars\/42\/[0-9a-f]{12}\.png$/)
    expect(playerAvatarKey(42, bytes, 'image/jpeg')).toMatch(/\.jpg$/)
  })

  it('changes the key when the bytes change (cache-safe re-seed)', () => {
    const a = playerAvatarKey(42, bytes, 'image/png')
    const b = playerAvatarKey(42, new Uint8Array([9, 9, 9]), 'image/png')
    expect(a).not.toBe(b)
  })

  it('rejects a content type we do not store', () => {
    expect(() => playerAvatarKey(42, bytes, 'image/svg+xml')).toThrow()
  })
})
