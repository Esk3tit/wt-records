import { afterEach, describe, expect, it } from 'vitest'
import { createStorage, storageFromEnvIfConfigured } from '#/storage/r2'
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

describe('storageFromEnvIfConfigured', () => {
  const NAMES = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_PUBLIC',
    'R2_BUCKET_PENDING',
    'R2_BUCKET_ASSETS',
    'R2_PUBLIC_BASE_URL',
    'R2_ASSETS_BASE_URL',
  ]
  const saved = NAMES.map((n) => [n, process.env[n]] as const)
  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  it('returns a storage when every R2 var is set', () => {
    for (const name of NAMES) process.env[name] = `test-${name}`
    expect(storageFromEnvIfConfigured()).toBeDefined()
  })

  it('returns undefined instead of throwing on a partial config', () => {
    for (const name of NAMES) process.env[name] = `test-${name}`
    delete process.env.R2_BUCKET_PENDING
    expect(storageFromEnvIfConfigured()).toBeUndefined()
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
