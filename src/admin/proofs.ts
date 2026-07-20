import {
  RASTER_EXTENSION_BY_CONTENT_TYPE,
  RASTER_IMAGE_CONTENT_TYPES,
} from '#/storage/image-types'
import type { Storage } from '#/storage/r2'

// Validate everything first, then PUT to R2; the caller inserts DB rows and
// rolls the uploads back on failure — no orphans, no half-proofed records.
export const MAX_PROOF_BYTES = 10 * 1024 * 1024

export function validateProofFile(file: {
  contentType: string
  size: number
}): void {
  if (!RASTER_IMAGE_CONTENT_TYPES.has(file.contentType)) {
    throw new Error(
      `Proof uploads must be raster images (got ${file.contentType || 'unknown'})`,
    )
  }
  if (file.size <= 0) throw new Error('Proof file is empty')
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error('Proof file exceeds the 10 MB limit')
  }
}

const ASCII = (s: string) => [...s].map((c) => c.charCodeAt(0))
const matchAt = (bytes: Uint8Array, offset: number, sig: number[]) =>
  sig.every((b, i) => bytes[offset + i] === b)

// The browser-supplied content type is untrusted — the bytes must carry the
// declared format's signature or the upload is refused (defense in depth).
const MAGIC_BY_CONTENT_TYPE = new Map<string, (b: Uint8Array) => boolean>([
  [
    'image/png',
    (b) => matchAt(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ],
  ['image/jpeg', (b) => matchAt(b, 0, [0xff, 0xd8, 0xff])],
  ['image/gif', (b) => matchAt(b, 0, ASCII('GIF8'))],
  [
    'image/webp',
    (b) => matchAt(b, 0, ASCII('RIFF')) && matchAt(b, 8, ASCII('WEBP')),
  ],
  // AVIF: ftyp is [size][ftyp][major brand][minor version][compatible...] —
  // accept avif/avis as the major brand (offset 8) or among the compatible
  // brands (offset 16+); offset 12 is the minor version, never a brand.
  [
    'image/avif',
    (b) => {
      if (!matchAt(b, 4, ASCII('ftyp'))) return false
      const brandAt = (offset: number) =>
        matchAt(b, offset, ASCII('avif')) || matchAt(b, offset, ASCII('avis'))
      if (brandAt(8)) return true
      const boxSize =
        ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0 || b.length
      const end = Math.min(boxSize, b.length, 64)
      for (let offset = 16; offset + 4 <= end; offset += 4) {
        if (brandAt(offset)) return true
      }
      return false
    },
  ],
])

export function assertProofBytesMatchType(
  bytes: Uint8Array,
  contentType: string,
): void {
  const matches = MAGIC_BY_CONTENT_TYPE.get(contentType)
  if (!matches || !matches(bytes)) {
    throw new Error(
      `File contents do not match the declared image type (${contentType})`,
    )
  }
}

export function proofObjectKey(
  contentType: string,
  id: string = crypto.randomUUID(),
): string {
  const ext = RASTER_EXTENSION_BY_CONTENT_TYPE[contentType]
  if (!ext) throw new Error(`Unsupported proof content type ${contentType}`)
  return `entries/${id}.${ext}`
}

export type ImageProofKind = 'scoreboard' | 'end_game' | 'end_life'

export interface ProofFileInput {
  kind: ImageProofKind
  contentType: string
  bytes: Uint8Array
  originalUrl?: string | null
}

export interface UploadedProofRow {
  kind: ImageProofKind
  storagePath: string
  originalUrl: string | null
}

export async function uploadProofFiles(
  storage: Storage,
  files: ProofFileInput[],
): Promise<UploadedProofRow[]> {
  for (const f of files) {
    validateProofFile({ contentType: f.contentType, size: f.bytes.byteLength })
    assertProofBytesMatchType(f.bytes, f.contentType)
  }
  const uploaded: UploadedProofRow[] = []
  try {
    for (const f of files) {
      const key = proofObjectKey(f.contentType)
      await storage.put('proofs', key, f.bytes, f.contentType)
      uploaded.push({
        kind: f.kind,
        storagePath: key,
        originalUrl: f.originalUrl ?? null,
      })
    }
  } catch (error) {
    await deleteProofObjects(
      storage,
      uploaded.map((u) => u.storagePath),
    )
    throw error
  }
  return uploaded
}

/** Rollback for uploads whose DB insert failed — best effort by design: a
    stray object is cheaper than masking the original error. */
export async function deleteProofObjects(
  storage: Storage,
  keys: string[],
): Promise<void> {
  for (const key of keys) {
    try {
      await storage.delete('proofs', key)
    } catch (error) {
      // swallowed on purpose (see docstring), but the orphan is findable:
      console.warn(`failed to delete proof object ${key}`, error)
    }
  }
}
