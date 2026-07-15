import { describe, expect, it } from 'vitest'
import {
  MAX_PROOF_BYTES,
  proofObjectKey,
  uploadProofFiles,
  deleteProofObjects,
  validateProofFile,
} from '#/admin/proofs'
import type { Storage } from '#/storage/r2'

function fakeStorage(opts?: { failOnKey?: (key: string) => boolean }) {
  const puts: string[] = []
  const deletes: string[] = []
  const storage = {
    async put(_role: string, key: string) {
      if (opts?.failOnKey?.(key)) throw new Error('R2 unavailable')
      puts.push(key)
    },
    async delete(_role: string, key: string) {
      deletes.push(key)
    },
  } as unknown as Storage
  return { storage, puts, deletes }
}

const file = (
  over: Partial<Parameters<typeof uploadProofFiles>[1][number]> = {},
) => ({
  kind: 'scoreboard' as const,
  contentType: 'image/webp',
  bytes: new Uint8Array([1, 2, 3]),
  originalUrl: null,
  ...over,
})

describe('validateProofFile', () => {
  it('accepts raster images under the cap', () => {
    expect(() =>
      validateProofFile({ contentType: 'image/png', size: 1024 }),
    ).not.toThrow()
  })

  it('rejects non-raster content types (svg, video, arbitrary)', () => {
    for (const contentType of [
      'image/svg+xml',
      'video/mp4',
      'application/pdf',
      'text/html',
    ]) {
      expect(() => validateProofFile({ contentType, size: 10 })).toThrow(
        /image/i,
      )
    }
  })

  it('rejects files over the cap and empty files', () => {
    expect(() =>
      validateProofFile({
        contentType: 'image/png',
        size: MAX_PROOF_BYTES + 1,
      }),
    ).toThrow(/10/)
    expect(() =>
      validateProofFile({ contentType: 'image/png', size: 0 }),
    ).toThrow()
  })
})

describe('proofObjectKey', () => {
  it('builds an entries/-scoped key with the extension from the content type', () => {
    expect(proofObjectKey('image/jpeg', 'abc-123')).toBe('entries/abc-123.jpg')
    expect(proofObjectKey('image/webp', 'abc-123')).toBe('entries/abc-123.webp')
  })

  it('generates unique keys by default', () => {
    expect(proofObjectKey('image/png')).not.toBe(proofObjectKey('image/png'))
  })
})

describe('uploadProofFiles', () => {
  it('uploads every file to the proofs bucket and returns proof rows in order', async () => {
    const { storage, puts } = fakeStorage()
    const rows = await uploadProofFiles(storage, [
      file({ kind: 'scoreboard' }),
      file({ kind: 'end_game', originalUrl: 'https://x.test/a.png' }),
    ])
    expect(puts).toHaveLength(2)
    expect(rows.map((r) => r.kind)).toEqual(['scoreboard', 'end_game'])
    expect(rows[0].storagePath).toMatch(/^entries\/.+\.webp$/)
    expect(rows[1].originalUrl).toBe('https://x.test/a.png')
  })

  it('validates before uploading anything', async () => {
    const { storage, puts } = fakeStorage()
    await expect(
      uploadProofFiles(storage, [file(), file({ contentType: 'video/mp4' })]),
    ).rejects.toThrow(/image/i)
    expect(puts).toHaveLength(0)
  })

  it('cleans up already-uploaded objects when a later upload fails', async () => {
    const { storage, puts, deletes } = fakeStorage({
      failOnKey: (key) => puts.length === 1 && key !== puts[0],
    })
    await expect(uploadProofFiles(storage, [file(), file()])).rejects.toThrow(
      /unavailable/,
    )
    expect(puts).toHaveLength(1)
    expect(deletes).toEqual(puts)
  })
})

describe('deleteProofObjects', () => {
  it('best-effort deletes and never throws', async () => {
    const failing = {
      async delete() {
        throw new Error('nope')
      },
    } as unknown as Storage
    await expect(
      deleteProofObjects(failing, ['entries/a.webp']),
    ).resolves.toBeUndefined()
  })
})
