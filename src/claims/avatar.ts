import { eq } from 'drizzle-orm'
import type { Db } from '#/db'
import { players } from '#/db/schema'
import type { Storage } from '#/storage/r2'
import { fetchUpstream } from '#/catalog/upstream-fetch'
import {
  MAX_AVATAR_BYTES,
  RASTER_IMAGE_CONTENT_TYPES,
} from '#/storage/image-types'
import { playerAvatarKey } from '#/storage/avatar-key'
import { isAllowedAvatarHost } from '#/auth/profile'

/* Avatar bytes: mirroring a provider picture in, and cleaning an object up once
   nothing points at it. The claim lifecycle and the owner's own controls both
   spend these; neither should have to know about content-hashed keys. */

export type AvatarStore = Pick<Storage, 'put' | 'delete'>

/** Fetch the provider picture and mirror it into the assets bucket. Best-effort:
    any failure returns null so a flaky image never blocks a legitimate claim —
    the Player falls back to the Medallion, which a later upload flow replaces. */
export async function seedAvatar(
  store: AvatarStore,
  playerId: number,
  url: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  // Re-validate the host at the fetch boundary (defence in depth) and refuse
  // redirects — a provider CDN must never bounce the server fetch off-host.
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return null
  }
  if (!isAllowedAvatarHost(hostname)) return null
  try {
    const res = await fetchUpstream(url, {
      fetchImpl,
      timeoutMs: 15_000,
      redirect: 'error',
      // One shot: the seed is best-effort with a Medallion fallback, so don't
      // spend retry backoff on a transient blip or a redirect rejection.
      maxAttempts: 1,
    })
    const contentType =
      res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!RASTER_IMAGE_CONTENT_TYPES.has(contentType)) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
    const bytes = await readCapped(res, MAX_AVATAR_BYTES)
    if (!bytes || bytes.byteLength === 0) return null
    const key = playerAvatarKey(playerId, bytes, contentType)
    await store.put('assets', key, bytes, contentType)
    return key
  } catch {
    return null
  }
}

/** Read a response body but never buffer more than `max` bytes: a
    content-length precheck plus a streamed cap, so a lying or unbounded
    upstream can't exhaust process memory. */
async function readCapped(
  res: Response,
  max: number,
): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) {
    await res.body?.cancel().catch(() => undefined)
    return null
  }
  const reader = res.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/** Delete an avatar object only when no player row still references its key —
    a content-addressed key can be re-referenced by a concurrent seed. Fully
    best-effort: it runs after the owning write has committed at every call
    site, so a leaked object must never surface as an error. */
export async function deleteAvatarIfUnreferenced(
  db: Db,
  store: AvatarStore,
  key: string,
): Promise<void> {
  try {
    const referenced =
      (
        await db
          .select({ id: players.id })
          .from(players)
          .where(eq(players.avatarKey, key))
          .limit(1)
      ).length > 0
    if (!referenced) await store.delete('assets', key)
  } catch {
    // A post-commit cleanup failure only leaks bytes; never fail the caller.
  }
}
