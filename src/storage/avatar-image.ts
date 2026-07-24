import sharp from 'sharp'
import type { Metadata } from 'sharp'
import { MAX_AVATAR_BYTES } from '#/storage/image-types'

export const AVATAR_DIMENSION = 512

// The raster formats we accept as avatar input — the same set the rest of the
// site allows. SVG is excluded on purpose: it is active content and is never
// trusted, even rasterised.
const ACCEPTED_INPUT_FORMATS = new Set(['png', 'jpeg', 'webp', 'gif'])

const NOT_AN_IMAGE =
  'That file is not a supported image — upload a JPEG, PNG, WebP, GIF, or AVIF.'

/** Whether sharp decoded a raster format we accept. sharp reports both AVIF and
    HEIC as the `heif` container, so AVIF is matched by its AV1 payload — HEIC's
    HEVC is rejected (it is not in the site's raster set). */
function isAcceptedRaster(meta: Metadata): boolean {
  if (ACCEPTED_INPUT_FORMATS.has(meta.format)) return true
  return meta.format === 'heif' && meta.compression === 'av1'
}

/** Decode arbitrary user bytes and re-encode a square 512×512 WebP avatar,
    center-cropped, animation flattened to a single frame. Trust comes from the
    decode, not any declared content type: anything that is not a supported
    static raster is rejected with a user-facing message, and sharp's default
    input-pixel limit guards decode bombs. Never returns the original bytes. */
export async function encodeAvatar(input: Uint8Array): Promise<Uint8Array> {
  if (input.byteLength === 0) throw new Error('The uploaded file is empty.')
  if (input.byteLength > MAX_AVATAR_BYTES) {
    throw new Error('Keep the image under 5 MB.')
  }
  // Default (animated: false) reads only the first frame, so an animated GIF or
  // WebP is flattened; the metadata read also rejects non-image bytes.
  const pipeline = sharp(Buffer.from(input))
  let meta: Metadata
  try {
    meta = await pipeline.metadata()
  } catch {
    throw new Error(NOT_AN_IMAGE)
  }
  if (!isAcceptedRaster(meta)) {
    throw new Error(NOT_AN_IMAGE)
  }
  try {
    const out = await pipeline
      .resize(AVATAR_DIMENSION, AVATAR_DIMENSION, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 82 })
      .toBuffer()
    return new Uint8Array(out)
  } catch (error) {
    // A header that decodes but a body that doesn't (truncated/bomb) lands here;
    // keep the diagnostic detail in the logs behind the generic user message.
    console.warn('avatar re-encode failed', error)
    throw new Error(NOT_AN_IMAGE)
  }
}
