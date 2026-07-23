import { createHash } from 'node:crypto'
import { RASTER_EXTENSION_BY_CONTENT_TYPE } from '#/storage/image-types'
import { assertValidObjectKey } from '#/storage/urls'

/** Assets-bucket key for a Player's site-owned avatar. Content-hashed so a
    re-seed or later on-site upload lands on a fresh key and never serves stale
    bytes from a CDN cache. Throws on a content type we don't store. */
export function playerAvatarKey(
  playerId: number,
  bytes: Uint8Array,
  contentType: string,
): string {
  const ext = RASTER_EXTENSION_BY_CONTENT_TYPE[contentType]
  if (!ext) {
    throw new Error(
      `Unsupported avatar content type ${JSON.stringify(contentType)}`,
    )
  }
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
  const key = `avatars/${playerId}/${hash}.${ext}`
  assertValidObjectKey(key)
  return key
}
