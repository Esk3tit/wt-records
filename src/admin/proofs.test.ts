import { describe, expect, it } from 'vitest'
import {
  MAX_PROOF_BYTES,
  assertProofBytesMatchType,
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

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
const WEBP_BYTES = new Uint8Array([
  ...ascii('RIFF'),
  0,
  0,
  0,
  0,
  ...ascii('WEBP'),
])
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

const file = (
  over: Partial<Parameters<typeof uploadProofFiles>[1][number]> = {},
) => ({
  kind: 'scoreboard' as const,
  contentType: 'image/webp',
  bytes: WEBP_BYTES,
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

describe('assertProofBytesMatchType', () => {
  it('accepts bytes carrying the declared signature', () => {
    expect(() =>
      assertProofBytesMatchType(WEBP_BYTES, 'image/webp'),
    ).not.toThrow()
    expect(() =>
      assertProofBytesMatchType(PNG_BYTES, 'image/png'),
    ).not.toThrow()
  })

  it('accepts AVIF whose avif brand is compatible, not major (mif1)', () => {
    // size(16) + 'ftyp' + major 'mif1' + minor + compatible 'avif'
    const mif1 = new Uint8Array([
      0,
      0,
      0,
      16,
      ...ascii('ftyp'),
      ...ascii('mif1'),
      ...ascii('avif'),
    ])
    expect(() => assertProofBytesMatchType(mif1, 'image/avif')).not.toThrow()
    const noAvif = new Uint8Array([
      0,
      0,
      0,
      16,
      ...ascii('ftyp'),
      ...ascii('mp42'),
      ...ascii('isom'),
    ])
    expect(() => assertProofBytesMatchType(noAvif, 'image/avif')).toThrow()
  })

  it('rejects bytes that do not match the declared type', () => {
    // HTML smuggled under an image content type must not reach R2.
    const html = new Uint8Array(ascii('<script>alert(1)</script>'))
    expect(() => assertProofBytesMatchType(html, 'image/webp')).toThrow(
      /match/i,
    )
    // A real PNG declared as webp is still a lie about the served type.
    expect(() => assertProofBytesMatchType(PNG_BYTES, 'image/webp')).toThrow()
  })

  it('rejects uploads whose bytes fail the sniff before anything uploads', async () => {
    const { storage, puts } = fakeStorage()
    await expect(
      uploadProofFiles(storage, [
        file({ bytes: new Uint8Array(ascii('not an image')) }),
      ]),
    ).rejects.toThrow(/match/i)
    expect(puts).toHaveLength(0)
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
