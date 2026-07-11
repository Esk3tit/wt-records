/* Imgur album resolution via imgur's web-client endpoint (ADR 0007). The
   official API is unobtainable; this endpoint returns all album media and
   exact upload timestamps anonymously, using the public client-id imgur's
   own site ships in its JS bundle. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const IMGUR_WEB_CLIENT_ID = '546c25a59c58ad7'

export type ProofUrlKind = 'imgur-album' | 'imgur-image' | 'video' | 'unknown'

export interface ClassifiedProofUrl {
  kind: ProofUrlKind
  /** Imgur post id, for the imgur kinds. */
  imgurId?: string
}

const VIDEO_HOSTS = [
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  'tiktok.com',
  'bilibili.com',
]

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

/** Modern imgur paths embed a title slug (`/a/some-title-AbCd123`);
    the id is always the trailing hyphen-separated token. */
function imgurIdFromSegment(segment: string): string {
  const tail = segment.split('-').pop() ?? segment
  return tail.split('.')[0]
}

export function classifyProofUrl(rawUrl: string): ClassifiedProofUrl {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { kind: 'unknown' }
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')

  if (VIDEO_HOSTS.some((d) => hostMatches(host, d))) return { kind: 'video' }

  if (
    host === 'imgur.com' ||
    host === 'i.imgur.com' ||
    host === 'm.imgur.com'
  ) {
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return { kind: 'unknown' }
    if (segments[0] === 'a' || segments[0] === 'gallery') {
      const id = segments[1] ? imgurIdFromSegment(segments[1]) : null
      return id ? { kind: 'imgur-album', imgurId: id } : { kind: 'unknown' }
    }
    if (segments.length === 1) {
      return { kind: 'imgur-image', imgurId: imgurIdFromSegment(segments[0]) }
    }
    return { kind: 'unknown' }
  }

  return { kind: 'unknown' }
}

export interface ImgurMedia {
  id: string
  url: string
  ext: string | null
  createdAt: string | null
}

export interface ResolvedImgurPost {
  id: string
  status: 'ok' | 'dead'
  /** HTTP status for dead posts. */
  httpStatus?: number
  createdAt: string | null
  media: Array<ImgurMedia>
}

interface CacheEntry {
  fetchedAt: string
  resolved: ResolvedImgurPost
}

export interface ImgurResolverOptions {
  cacheDir: string
  fetchImpl?: typeof fetch
  /** Minimum ms between network requests (cache hits are free). */
  throttleMs?: number
  maxAttempts?: number
  sleepImpl?: (ms: number) => Promise<void>
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

interface ApiMedia {
  id?: string
  url?: string
  ext?: string
  created_at?: string
}

interface ApiPost {
  id?: string
  created_at?: string
  media?: Array<ApiMedia>
}

/** Resolves imgur posts with an on-disk cache so a killed run resumes where
    it stopped instead of re-hammering imgur. Dead posts (404/400) are cached;
    transient failures (429/5xx/network) retry and then abort the run. */
export class ImgurResolver {
  private readonly cacheDir: string
  private readonly fetchImpl: typeof fetch
  private readonly throttleMs: number
  private readonly maxAttempts: number
  private readonly sleepImpl: (ms: number) => Promise<void>
  private lastRequestAt = 0
  networkFetches = 0

  constructor(options: ImgurResolverOptions) {
    this.cacheDir = options.cacheDir
    this.fetchImpl = options.fetchImpl ?? fetch
    this.throttleMs = options.throttleMs ?? 1000
    this.maxAttempts = options.maxAttempts ?? 5
    this.sleepImpl = options.sleepImpl ?? sleep
    mkdirSync(this.cacheDir, { recursive: true })
  }

  async resolve(id: string): Promise<ResolvedImgurPost> {
    const cached = this.readCache(id)
    if (cached) return cached.resolved

    const resolved = await this.fetchPost(id)
    this.writeCache(id, resolved)
    return resolved
  }

  private cachePath(id: string): string {
    if (!/^[A-Za-z0-9]+$/.test(id)) {
      throw new Error(`Unsafe imgur id ${JSON.stringify(id)}`)
    }
    return join(this.cacheDir, `${id}.json`)
  }

  private readCache(id: string): CacheEntry | null {
    try {
      return JSON.parse(readFileSync(this.cachePath(id), 'utf8')) as CacheEntry
    } catch {
      return null
    }
  }

  private writeCache(id: string, resolved: ResolvedImgurPost): void {
    const entry: CacheEntry = {
      fetchedAt: new Date().toISOString(),
      resolved,
    }
    writeFileSync(this.cachePath(id), `${JSON.stringify(entry, null, 2)}\n`)
  }

  private async throttled(url: string): Promise<Response> {
    const wait = this.lastRequestAt + this.throttleMs - Date.now()
    if (wait > 0) await this.sleepImpl(wait)
    this.lastRequestAt = Date.now()
    this.networkFetches += 1
    return this.fetchImpl(url)
  }

  private async fetchPost(id: string): Promise<ResolvedImgurPost> {
    // Albums and single-image posts are both posts; the albums endpoint
    // serves album ids, single-image pages resolve via the media fallback.
    const urls = [
      `https://api.imgur.com/post/v1/albums/${id}?client_id=${IMGUR_WEB_CLIENT_ID}&include=media`,
      `https://api.imgur.com/post/v1/media/${id}?client_id=${IMGUR_WEB_CLIENT_ID}&include=media`,
    ]
    let lastDeadStatus: number | undefined
    for (const url of urls) {
      const res = await this.fetchWithRetry(url)
      if (res.ok) {
        const body = (await res.json()) as ApiPost
        return this.toResolved(id, body)
      }
      lastDeadStatus = res.status
    }
    return {
      id,
      status: 'dead',
      httpStatus: lastDeadStatus,
      createdAt: null,
      media: [],
    }
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let attempt = 0
    for (;;) {
      attempt += 1
      let res: Response | null = null
      let networkError: unknown = null
      try {
        res = await this.throttled(url)
      } catch (error) {
        networkError = error
      }
      // 404/400 = permanently dead (cacheable); everything else transient.
      if (res && (res.ok || res.status === 404 || res.status === 400)) {
        return res
      }
      if (attempt >= this.maxAttempts) {
        const detail = res
          ? `HTTP ${res.status}`
          : networkError instanceof Error
            ? networkError.message
            : String(networkError)
        throw new Error(
          `imgur fetch failed after ${attempt} attempts (${detail}): ${url}`,
        )
      }
      const retryAfter = res?.headers.get('retry-after')
      const backoff = retryAfter
        ? Number(retryAfter) * 1000
        : 2000 * 2 ** (attempt - 1)
      await this.sleepImpl(backoff)
    }
  }

  private toResolved(id: string, body: ApiPost): ResolvedImgurPost {
    const media = (body.media ?? []).map((m, index) => {
      const mediaId = m.id ?? `${id}-${index}`
      const ext = m.ext?.replace(/^\./, '').toLowerCase() ?? null
      const url =
        m.url ?? (ext ? `https://i.imgur.com/${mediaId}.${ext}` : null)
      if (!url) {
        throw new Error(`imgur media ${mediaId} in post ${id} has no URL`)
      }
      return { id: mediaId, url, ext, createdAt: m.created_at ?? null }
    })
    const mediaDates = media
      .map((m) => m.createdAt)
      .filter((d): d is string => d !== null)
      .sort()
    const createdAt = body.created_at ?? mediaDates.at(0) ?? null
    return { id, status: 'ok', createdAt, media }
  }
}
