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
    } catch {
      // swallowed on purpose; see docstring
    }
  }
}
