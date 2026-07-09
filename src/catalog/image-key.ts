import { createHash } from 'node:crypto'
import { assertValidObjectKey } from '#/storage/urls'

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'avif',
  'svg',
])

/** Assets-bucket key for a vehicle image; embeds a source-URL hash so an
    upstream URL change yields a new key (= "needs re-mirror"). */
export function vehicleImageKey(externalId: string, sourceUrl: string): string {
  const hash = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 8)
  const ext = new URL(sourceUrl).pathname.split('.').pop()?.toLowerCase()
  const suffix = ext && IMAGE_EXTENSIONS.has(ext) ? `.${ext}` : ''
  const key = `vehicles/${externalId}-${hash}${suffix}`
  assertValidObjectKey(key)
  return key
}
