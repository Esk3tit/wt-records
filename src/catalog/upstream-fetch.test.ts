import { describe, expect, it, vi } from 'vitest'
import { fetchUpstream } from '#/catalog/upstream-fetch'

const URL_UNDER_TEST = 'https://wt.example/vehicles'

const reply = (
  status: number,
  body: BodyInit,
  contentType = 'application/json',
) => new Response(body, { status, headers: { 'content-type': contentType } })

const streamed = (
  status: number,
  chunks: Iterable<string>,
  contentType = 'application/json',
) => {
  const encoder = new TextEncoder()
  const iterator = chunks[Symbol.iterator]()
  const body = new ReadableStream({
    pull(controller) {
      const next = iterator.next()
      if (next.done) controller.close()
      else controller.enqueue(encoder.encode(next.value))
    },
  })
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  })
}

function* endlessWhitespace(): Generator<string> {
  for (;;) yield ' '
}

/** Headers arrive, then the body never produces a chunk — a stalled upstream. */
const stalling = (status: number, contentType = 'application/json') =>
  new Response(
    new ReadableStream({
      pull: () => new Promise<never>(() => undefined),
    }),
    { status, headers: { 'content-type': contentType } },
  )

const stub = (...responses: Array<Response>) => {
  const calls: Array<string> = []
  const fetchImpl = ((url: string) => {
    calls.push(url)
    return Promise.resolve(responses[calls.length - 1] ?? responses.at(-1)!)
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

async function failureMessage(...responses: Array<Response>): Promise<string> {
  const { fetchImpl } = stub(...responses)
  try {
    await fetchUpstream(URL_UNDER_TEST, { fetchImpl, maxAttempts: 1 })
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected fetchUpstream to reject')
}

describe('fetchUpstream error context', () => {
  it('carries the upstream reason, not just the status', async () => {
    const message = await failureMessage(
      reply(500, '{"error":"SQLITE_CORRUPT: disk image is malformed"}'),
    )

    expect(message).toBe(
      `GET ${URL_UNDER_TEST} → 500: {"error":"SQLITE_CORRUPT: disk image is malformed"}`,
    )
  })

  it('reassembles a reason split across stream chunks', async () => {
    const message = await failureMessage(
      streamed(500, [
        '{"error":"SQLITE_',
        'CORRUPT: disk image',
        ' is malformed"}',
      ]),
    )

    expect(message).toBe(
      `GET ${URL_UNDER_TEST} → 500: {"error":"SQLITE_CORRUPT: disk image is malformed"}`,
    )
  })

  it('reads the body when the content-type is not lowercase', async () => {
    const message = await failureMessage(reply(500, 'boom', 'Text/Plain'))

    expect(message).toBe(`GET ${URL_UNDER_TEST} → 500: boom`)
  })

  it('gives up on a body that never sends a chunk', async () => {
    vi.useFakeTimers()
    try {
      const pending = failureMessage(stalling(500))
      await vi.advanceTimersByTimeAsync(2000)
      expect(await pending).toBe(`GET ${URL_UNDER_TEST} → 500`)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops reading an endless body instead of hanging', async () => {
    const message = await failureMessage(
      streamed(500, endlessWhitespace(), 'text/plain'),
    )

    expect(message).toBe(`GET ${URL_UNDER_TEST} → 500`)
  })

  it('collapses and truncates a runaway error page', async () => {
    const body = `<html>\n   <body>${'oops '.repeat(200)}</body>\n</html>`

    const message = await failureMessage(reply(502, body, 'text/html'))

    expect(message).toMatch(/→ 502: <html> <body>(oops ){10}/)
    expect(message.length).toBeLessThan(300)
  })

  it('keeps binary bodies out of the message', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    const message = await failureMessage(reply(500, png.buffer, 'image/png'))

    expect(message).toBe(`GET ${URL_UNDER_TEST} → 500`)
  })

  it('still fails fast on a non-transient status', async () => {
    const { fetchImpl, calls } = stub(reply(404, 'gone', 'text/plain'))

    await expect(
      fetchUpstream(URL_UNDER_TEST, {
        fetchImpl,
        maxAttempts: 3,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow(/→ 404: gone/)
    expect(calls).toHaveLength(1)
  })

  it('retries a 5xx and returns the eventual success', async () => {
    const { fetchImpl, calls } = stub(
      reply(500, 'down'),
      reply(200, '{"ok":true}'),
    )

    const response = await fetchUpstream(URL_UNDER_TEST, {
      fetchImpl,
      maxAttempts: 3,
      retryDelayMs: 0,
    })

    expect(await response.json()).toEqual({ ok: true })
    expect(calls).toHaveLength(2)
  })
})
