import { describe, expect, it } from 'vitest'
import { createStorage } from '#/storage/r2'
import type { StorageConfig } from '#/storage/r2'

const config: StorageConfig = {
  endpoint: 'https://acct123.r2.cloudflarestorage.com',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  buckets: {
    proofs: 'wt-records-proofs',
    pending: 'wt-records-proofs-pending',
    assets: 'wt-records-assets',
  },
  publicBaseUrls: {
    proofs: 'https://proofs.wtrecords.gg',
    assets: 'https://assets.wtrecords.gg',
  },
}

describe('signedGetUrl', () => {
  it('signs a GET against the endpoint and pending bucket', async () => {
    const storage = createStorage(config)
    const url = new URL(
      await storage.signedGetUrl('pending', 'proofs/123/scoreboard.webp', 600),
    )
    expect(url.host).toBe(
      'wt-records-proofs-pending.acct123.r2.cloudflarestorage.com',
    )
    expect(url.pathname).toBe('/proofs/123/scoreboard.webp')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy()
  })
})

describe('publicUrl', () => {
  it('serves verified proofs from the proofs CDN domain', () => {
    const storage = createStorage(config)
    expect(storage.publicUrl('proofs', 'proofs/123/scoreboard.webp')).toBe(
      'https://proofs.wtrecords.gg/proofs/123/scoreboard.webp',
    )
  })

  it('rejects malformed keys', () => {
    const storage = createStorage(config)
    expect(() => storage.publicUrl('proofs', '../etc/passwd')).toThrow(
      /object key/i,
    )
  })
})

describe('object operations', () => {
  it('reject malformed keys before touching the network', async () => {
    const storage = createStorage(config)
    await expect(
      storage.put('pending', '', new Uint8Array(), 'image/webp'),
    ).rejects.toThrow(/object key/i)
    await expect(storage.get('pending', '/leading')).rejects.toThrow(
      /object key/i,
    )
    await expect(storage.delete('pending', 'a//b')).rejects.toThrow(
      /object key/i,
    )
    await expect(
      storage.signedGetUrl('pending', 'a/../b', 600),
    ).rejects.toThrow(/object key/i)
  })
})
