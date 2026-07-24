import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { encodeAvatar } from '#/storage/avatar-image'
import { MAX_AVATAR_BYTES } from '#/storage/image-types'

/* Runs in the node project (native sharp): the re-encode is pure, but sharp is
   a native addon that won't load under the jsdom unit environment. */

/** A solid-colour raster in the requested format — a tiny real image fixture. */
async function solid(
  format: 'png' | 'jpeg' | 'webp',
  width: number,
  height: number,
  color = { r: 204, g: 51, b: 51 },
): Promise<Uint8Array> {
  const img = sharp({
    create: { width, height, channels: 3, background: color },
  })
  const buf = await (
    format === 'png' ? img.png() : format === 'jpeg' ? img.jpeg() : img.webp()
  ).toBuffer()
  return new Uint8Array(buf)
}

async function animatedGif(): Promise<Uint8Array> {
  const red = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .gif()
    .toBuffer()
  const blue = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 0, g: 0, b: 255 },
    },
  })
    .gif()
    .toBuffer()
  const buf = await sharp([red, blue], { join: { animated: true } })
    .gif()
    .toBuffer()
  return new Uint8Array(buf)
}

const meta = (bytes: Uint8Array) => sharp(Buffer.from(bytes)).metadata()

describe('encodeAvatar', () => {
  it('re-encodes a non-square raster to a 512×512 WebP', async () => {
    const out = await encodeAvatar(await solid('png', 200, 100))
    const m = await meta(out)
    expect(m.format).toBe('webp')
    expect(m.width).toBe(512)
    expect(m.height).toBe(512)
  })

  it('accepts JPEG and WebP inputs too', async () => {
    for (const fmt of ['jpeg', 'webp'] as const) {
      const m = await meta(await encodeAvatar(await solid(fmt, 300, 300)))
      expect(m.format).toBe('webp')
      expect(m.width).toBe(512)
    }
  })

  it('flattens an animated input to a single frame', async () => {
    const out = await encodeAvatar(await animatedGif())
    const m = await sharp(Buffer.from(out), { animated: true }).metadata()
    expect(m.format).toBe('webp')
    // A flattened still has no extra pages (undefined or 1, never 2).
    expect(m.pages ?? 1).toBe(1)
  })

  it('rejects bytes that do not decode as an image', async () => {
    await expect(encodeAvatar(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(
      /not a supported image/i,
    )
    await expect(
      encodeAvatar(new TextEncoder().encode('this is not an image')),
    ).rejects.toThrow(/not a supported image/i)
  })

  it('rejects SVG — active content is never trusted, even rasterised', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    )
    await expect(encodeAvatar(svg)).rejects.toThrow(/not a supported image/i)
  })

  it('rejects an empty file', async () => {
    await expect(encodeAvatar(new Uint8Array(0))).rejects.toThrow(/empty/i)
  })

  it('enforces the 5 MB cap before decoding', async () => {
    await expect(
      encodeAvatar(new Uint8Array(MAX_AVATAR_BYTES + 1)),
    ).rejects.toThrow(/5 MB/i)
  })
})
