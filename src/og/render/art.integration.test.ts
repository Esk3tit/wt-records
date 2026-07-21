import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveArt } from './art'

/* Runs in the node project for real fetch/Response/ReadableStream. Proves the
   art fetch fails safe: any miss → null (never throws into the renderer) and the
   4 MB cap bounds the read, including a lying/absent content-length. */

afterEach(() => vi.unstubAllGlobals())

function stubFetch(response: Response | (() => never)) {
  const fetchMock = vi.fn(async () =>
    typeof response === 'function' ? response() : response,
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4])

describe('resolveArt', () => {
  it('returns a data-URI for a small image', async () => {
    stubFetch(
      new Response(PNG_BYTES, { headers: { 'content-type': 'image/png' } }),
    )
    expect(await resolveArt('https://cdn/x.png')).toMatch(
      /^data:image\/png;base64,/,
    )
  })

  it('returns null without fetching when the url is null', async () => {
    const fetchMock = stubFetch(
      new Response(PNG_BYTES, { headers: { 'content-type': 'image/png' } }),
    )
    expect(await resolveArt(null)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts an image with an upper-case / parameterized content-type', async () => {
    stubFetch(
      new Response(PNG_BYTES, {
        headers: { 'content-type': 'Image/PNG; charset=binary' },
      }),
    )
    expect(await resolveArt('https://cdn/x.png')).toMatch(
      /^data:image\/png;base64,/,
    )
  })

  it('rejects a non-image response', async () => {
    stubFetch(
      new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    )
    expect(await resolveArt('https://cdn/x')).toBeNull()
  })

  it('rejects an over-large declared content-length before reading', async () => {
    stubFetch(
      new Response(PNG_BYTES, {
        headers: {
          'content-type': 'image/png',
          'content-length': String(5_000_000),
        },
      }),
    )
    expect(await resolveArt('https://cdn/x.png')).toBeNull()
  })

  it('aborts a body that exceeds the cap mid-stream (no content-length)', async () => {
    // Up to 12 × 500 KB = 6 MB, past the 4 MB cap; the read must cancel the
    // stream partway rather than pull and buffer all 12 chunks.
    const chunk = new Uint8Array(500_000)
    let emitted = 0
    let canceled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (emitted++ < 12) controller.enqueue(chunk)
        else controller.close()
      },
      cancel() {
        canceled = true
      },
    })
    stubFetch(new Response(body, { headers: { 'content-type': 'image/png' } }))
    expect(await resolveArt('https://cdn/x.png')).toBeNull()
    // Cancelled at the cap (4 MB ≈ 8–9 chunks), never consuming all 12.
    expect(canceled).toBe(true)
    expect(emitted).toBeLessThan(12)
  })

  it('never throws into the renderer when the fetch fails', async () => {
    stubFetch(() => {
      throw new Error('network down')
    })
    expect(await resolveArt('https://cdn/x.png')).toBeNull()
  })
})
