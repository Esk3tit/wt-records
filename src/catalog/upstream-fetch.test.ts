import { describe, expect, it } from 'vitest'
import { fetchUpstream } from '#/catalog/upstream-fetch'

const URL_UNDER_TEST = 'https://wt.example/vehicles'

const reply = (
  status: number,
  body: BodyInit,
  contentType = 'application/json',
) => new Response(body, { status, headers: { 'content-type': contentType } })

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
