import { RASTER_IMAGE_EXTENSIONS } from '#/storage/image-types'
import { assertValidObjectKey } from '#/storage/urls'

const HEX = /^[0-9a-f]+$/

/** Assets-bucket key for a Portrait, addressed by the upstream content id so
    replaced artwork lands on a new key rather than under a reused one. */
export function portraitObjectKey(
  externalId: string,
  contentId: string,
  sourceUrl: string,
): string {
  const id = contentId.trim().toLowerCase()
  if (id.length < 8 || !HEX.test(id)) {
    throw new Error(
      `Unusable portrait content id: ${JSON.stringify(contentId)}`,
    )
  }
  const ext = new URL(sourceUrl).pathname.split('.').pop()?.toLowerCase()
  const suffix = ext && RASTER_IMAGE_EXTENSIONS.has(ext) ? `.${ext}` : ''
  const key = `vehicles/${externalId}-${id.slice(0, 8)}${suffix}`
  assertValidObjectKey(key)
  return key
}
