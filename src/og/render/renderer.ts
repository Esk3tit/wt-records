import { ImageResponse } from '@takumi-rs/image-response'
import type { ReactElement } from 'react'
import { FALLBACK_PNG } from '../assets/embedded'
import { OG_FONTS } from './fonts'

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

type ImageResponseOptions = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>
type Fonts = ImageResponseOptions['fonts']

/** Fully materialize the PNG before responding, so a mid-render failure surfaces
    here (→ static fallback) rather than as a half-streamed broken image. */
export async function renderCardPng(node: ReactElement): Promise<Uint8Array> {
  const res = new ImageResponse(node, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    format: 'png',
    fonts: OG_FONTS as unknown as Fonts,
  })
  await res.ready
  return new Uint8Array(await res.arrayBuffer())
}

// Edge-cached at Cloudflare; a Supersede changes the `?v=` URL, not this.
const CARD_CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate'

// A card whose content degraded from a transient miss (e.g. an avatar that
// failed to fetch) must not persist under its unchanged URL, or caches show the
// fallback until the URL next changes. no-store keeps it re-rendering to origin.
export const NO_STORE_CACHE_CONTROL = 'no-store'

export function cardResponse(
  bytes: Uint8Array,
  cacheControl: string = CARD_CACHE_CONTROL,
): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': cacheControl,
    },
  })
}

let fallbackBytes: Uint8Array | null = null
function loadFallback(): Uint8Array {
  if (!fallbackBytes) {
    fallbackBytes = new Uint8Array(Buffer.from(FALLBACK_PNG, 'base64'))
  }
  return fallbackBytes
}

// Any render failure serves the committed static card at 200 + no-store: scrapers
// may cache a failure, so no-store keeps the fallback out of the edge cache.
export function fallbackResponse(): Response {
  return new Response(loadFallback() as unknown as BodyInit, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  })
}

// Unknown slug / non-live mode → 404 so junk URLs can't fill the edge cache.
// Returned explicitly (never thrown), so it never routes into the render catch.
export function notFoundResponse(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/** Merge tombstone → permanent redirect to the survivor's card. */
export function movedResponse(location: string): Response {
  return new Response(null, {
    status: 301,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  })
}

// Since the HTTP status no longer signals failure (a broken render still 200s
// the fallback), monitoring must. Server-side Sentry is a separate follow-up —
// for now this reaches Railway's captured stderr.
export function reportCardError(context: string, err: unknown): void {
  console.error(`[og-card] render failed (${context}):`, err)
}

/** Strip an optional `.png` suffix — the route captures the whole last path
    segment, and the public card URL carries the extension. */
export function stripPng(slug: string): string {
  return slug.endsWith('.png') ? slug.slice(0, -4) : slug
}
