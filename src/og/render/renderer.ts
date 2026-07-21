import { ImageResponse } from '@takumi-rs/image-response'
import type { ReactElement } from 'react'
import fallbackUri from '../assets/fallback.png?inline'
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

export function cardResponse(bytes: Uint8Array): Response {
  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Edge-cached at Cloudflare; a Supersede changes the `?v=` URL, not this.
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate',
    },
  })
}

let fallbackBytes: Uint8Array | null = null
function loadFallback(): Uint8Array {
  if (!fallbackBytes) {
    fallbackBytes = new Uint8Array(
      Buffer.from(fallbackUri.slice(fallbackUri.indexOf(',') + 1), 'base64'),
    )
  }
  return fallbackBytes
}

/* Any render-time failure (DB brownout, corrupt data, renderer throw) serves the
   committed static card at 200 + no-store. Embed scrapers don't honor
   Retry-After and may cache a failure, so no-store keeps the fallback out of the
   edge cache and recovery is instant — the 200 no longer signals health, logs
   do. */
export function fallbackResponse(): Response {
  return new Response(loadFallback() as unknown as BodyInit, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  })
}

/* Unknown slug / non-live mode → 404: junk URLs can't fill the edge cache or
   fake a legitimate card. Distinct from a render failure (→ fallback): a 404 is
   an explicit return, never a throw, so it never routes into the catch. */
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

export function reportCardError(context: string, err: unknown): void {
  console.error(`[og-card] render failed (${context}):`, err)
}

/** Strip an optional `.png` suffix — the route captures the whole last path
    segment, and the public card URL carries the extension. */
export function stripPng(slug: string): string {
  return slug.endsWith('.png') ? slug.slice(0, -4) : slug
}
